# backend/app/routes/matrix.py
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import cast
from sqlmodel import Session, select

from app.core.dependencies import get_db, get_current_user, require_admin, require_superadmin
from app.core.ws_manager import ws_manager
from app.models.user import User
from app.models.project import Project
from app.models.matrix import QuestionCategory, MatrixQuestion, MatrixEvaluation, EvaluationResponse
from app.schemas.matrix import (
    CategoryRead, CategoryCreate, CategoryWithQuestionsCreate, CategoryWithQuestionsRead,
    QuestionRead, EvaluationSubmit, EvaluationRead, MatrixPlotPoint,
)
from app.services.matrix_service import (
    get_active_categories, get_active_questions,
    create_evaluation, get_evaluations_for_project,
    get_latest_evaluation_per_project,
)

router = APIRouter(prefix="/matrix", tags=["Matrix"])


# ── Categorías (Paquetes) ─────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista todos los paquetes de preguntas activos."""
    return get_active_categories(db)


@router.post("/categories", response_model=CategoryRead, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    """Crea un paquete vacío. Solo superadmin."""
    existing = db.exec(
        select(QuestionCategory).where(QuestionCategory.name == payload.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un paquete con ese nombre.")
    category = QuestionCategory(
        name=payload.name,
        description=payload.description,
        is_default=payload.is_default,
        is_active=True,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.post("/categories/with-questions", response_model=CategoryWithQuestionsRead, status_code=201)
def create_category_with_questions(
    payload: CategoryWithQuestionsCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_superadmin),
):
    """
    Crea un paquete completo con sus preguntas en un solo request.
    Valida que haya al menos 1 pregunta de impacto y 1 de esfuerzo.
    Este es el endpoint que usa el modal de aprobación cuando el superadmin crea un paquete nuevo.
    
    # TODO (Opción 2 futura): reemplazar el modal inline por navigate('/config/matrix')
    # y usar este endpoint desde esa página con UI más completa.
    """
    # Validar mínimo 1 impacto y 1 esfuerzo
    axes = [q.axis for q in payload.questions]
    if "impact" not in axes:
        raise HTTPException(
            status_code=422,
            detail="El paquete debe tener al menos 1 pregunta de eje Impacto."
        )
    if "effort" not in axes:
        raise HTTPException(
            status_code=422,
            detail="El paquete debe tener al menos 1 pregunta de eje Esfuerzo."
        )

    # Verificar nombre único
    existing = db.exec(
        select(QuestionCategory).where(QuestionCategory.name == payload.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un paquete con ese nombre.")

    # Crear categoría
    category = QuestionCategory(
        name=payload.name,
        description=payload.description,
        is_default=payload.is_default,
        is_active=True,
    )
    db.add(category)
    db.flush()  # necesitamos el ID antes de agregar preguntas

    # Crear preguntas
    created_questions = []
    for i, q in enumerate(payload.questions):
        if q.axis not in ("impact", "effort"):
            raise HTTPException(
                status_code=422,
                detail=f"Eje inválido '{q.axis}'. Solo 'impact' o 'effort'."
            )
        mq = MatrixQuestion(
            text=q.text.strip(),
            axis=q.axis,
            weight=q.weight,
            order=q.order if q.order != 0 else i,
            category_id=category.id,
            is_active=True,
        )
        db.add(mq)
        created_questions.append(mq)

    db.commit()
    db.refresh(category)

    return CategoryWithQuestionsRead(
        id=cast(int, category.id),
        name=category.name,
        description=category.description,
        is_default=category.is_default,
        is_active=category.is_active,
        questions=[
            QuestionRead(
                id=cast(int, q.id),
                text=q.text,
                axis=q.axis,
                weight=q.weight,
                order=q.order,
                category_id=cast(int, q.category_id),
                is_active=q.is_active,
            )
            for q in created_questions
        ],
    )


# ── Preguntas ─────────────────────────────────────────────────────────────────

@router.get("/questions", response_model=list[QuestionRead])
def list_questions(
    category_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Lista preguntas activas, opcionalmente filtrando por paquete."""
    return get_active_questions(db, category_id=category_id)


# ── Evaluación ────────────────────────────────────────────────────────────────

@router.post("/evaluate/{project_id}", response_model=EvaluationRead)
async def evaluate_project(
    project_id: int,
    payload: EvaluationSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Registra evaluación impacto/esfuerzo del proyecto.
    Solo admin y superadmin pueden evaluar.
    """
    assert current_user.id is not None
    evaluation = create_evaluation(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
        payload=payload,
    )
    assert evaluation.id is not None
    await ws_manager.broadcast(
        event_type="evaluation_created",
        payload={
            "project_id": project_id,
            "impact_score": evaluation.impact_score,
            "effort_score": evaluation.effort_score,
            "quadrant": evaluation.quadrant,
            "evaluation_id": evaluation.id,
        },
    )
    return EvaluationRead(
        id=cast(int, evaluation.id),
        project_id=evaluation.project_id,
        category_id=evaluation.category_id,
        impact_score=evaluation.impact_score,
        effort_score=evaluation.effort_score,
        quadrant=evaluation.quadrant,
        notes=evaluation.notes,
        created_at=evaluation.created_at,
    )


@router.get("/plot", response_model=list[MatrixPlotPoint])
def get_matrix_plot(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Puntos para la matriz cuadrante.
    - usuario: solo ve sus propios proyectos
    - coordinador, admin, superadmin: ven todos
    """
    owner_id = (
        None
        if current_user.role in ("admin", "superadmin", "coordinador")
        else current_user.id
    )
    return get_latest_evaluation_per_project(db, owner_id=owner_id)


@router.get("/history/{project_id}", response_model=list[EvaluationRead])
def get_project_history(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if (
        current_user.role not in ("admin", "superadmin", "coordinador")
        and project.owner_id != current_user.id
    ):
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto.")
    evaluations = get_evaluations_for_project(
        db, project_id=project_id, owner_id=project.owner_id
    )
    return [
        EvaluationRead(
            id=cast(int, e.id),
            project_id=e.project_id,
            category_id=e.category_id,
            impact_score=e.impact_score,
            effort_score=e.effort_score,
            quadrant=e.quadrant,
            notes=e.notes,
            created_at=e.created_at,
        )
        for e in evaluations
    ]
