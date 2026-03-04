from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.core.ws_manager import ws_manager
from app.models.user import User
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
def list_questions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Retorna las 10 preguntas activas ordenadas por eje y posición."""
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
        owner_email=current_user.email,
        evaluator_user_id=current_user.id,
        payload=payload,
    )

    # Broadcast en tiempo real al frontend
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
        id=evaluation.id,
        project_id=evaluation.project_id,
        evaluator_user_id=evaluation.evaluator_user_id,
        impact_score=evaluation.impact_score,
        effort_score=evaluation.effort_score,
        quadrant=evaluation.quadrant,
        notes=evaluation.notes,
        created_at=evaluation.created_at,
    )


@router.get("/plot", response_model=list[MatrixPlotPoint])
def get_matrix_plot(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retorna los puntos para renderizar la matriz cuadrante.
    Un punto por proyecto (evaluación más reciente).
    """
    return get_latest_evaluation_per_project(db, owner_email=current_user.email)


@router.get("/history/{project_id}", response_model=list[EvaluationRead])
def get_project_history(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Historial completo de re-evaluaciones de un proyecto (más reciente primero)."""
    evaluations = get_evaluations_for_project(db, project_id=project_id, owner_email=current_user.email)
    return [
        EvaluationRead(
            id=e.id,
            project_id=e.project_id,
            evaluator_user_id=e.evaluator_user_id,
            impact_score=e.impact_score,
            effort_score=e.effort_score,
            quadrant=e.quadrant,
            notes=e.notes,
            created_at=e.created_at,
        )
        for e in evaluations
    ]
