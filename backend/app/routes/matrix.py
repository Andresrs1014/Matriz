from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.dependencies import get_db, get_current_user
from app.core.ws_manager import ws_manager
from app.models.user import User
from app.models.project import Project
from app.models.matrix import MatrixEvaluation
from app.schemas.matrix import (
    QuestionRead,
    EvaluationSubmit,
    EvaluationRead,
    MatrixPlotPoint,
)
from app.services.matrix_service import (
    get_active_questions,
    create_evaluation,
    get_evaluations_for_project,
    get_latest_evaluation_per_project,
)

router = APIRouter(prefix="/matrix", tags=["Matrix"])


@router.get("/questions", response_model=list[QuestionRead])
def list_questions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna las preguntas activas ordenadas por eje y posición."""
    return get_active_questions(db)


@router.post("/evaluate/{project_id}", response_model=EvaluationRead)
async def evaluate_project(
    project_id: int,
    payload: EvaluationSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Registra una nueva evaluación para el proyecto indicado.
    Calcula impact_score, effort_score y cuadrante automáticamente.
    Emite evento WebSocket a todos los clientes conectados.
    """
    evaluation = create_evaluation(
        db=db,
        project_id=project_id,
        owner_id=current_user.id,
        payload=payload,
    )

    await ws_manager.broadcast(
        event_type="evaluation_created",
        payload={
            "project_id":    project_id,
            "impact_score":  evaluation.impact_score,
            "effort_score":  evaluation.effort_score,
            "quadrant":      evaluation.quadrant,
            "evaluation_id": evaluation.id,
        },
    )

    return EvaluationRead(
        id=evaluation.id,
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
    Retorna los puntos para renderizar la matriz cuadrante.
    Un punto por proyecto (evaluación más reciente).
    Admin ve todos, user ve solo los suyos.
    """
    owner_id = None if current_user.role in ("admin", "superadmin") else current_user.id
    return get_latest_evaluation_per_project(db, owner_id=owner_id)


@router.get("/history/{project_id}", response_model=list[EvaluationRead])
def get_project_history(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Historial completo de re-evaluaciones de un proyecto (más reciente primero)."""
    # Verificar acceso
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if current_user.role not in ("admin", "superadmin") and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto.")

    evaluations = get_evaluations_for_project(
        db,
        project_id=project_id,
        owner_id=current_user.id,
    )
    return [
        EvaluationRead(
            id=e.id,
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
