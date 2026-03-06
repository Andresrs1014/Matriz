from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.core.ws_manager import ws_manager
from app.models.user import User
from app.models.project import Project
from app.schemas.roi import ROIInput, ROIRead, ROIPlotPoint
from app.services.roi_service import (
    create_roi_evaluation,
    get_latest_roi,
    get_roi_history,
    get_roi_plot_points,
)

router = APIRouter(prefix="/roi", tags=["ROI"])


def _to_read(e: object) -> ROIRead:
    return ROIRead.model_validate(e)


@router.post("/evaluate/{project_id}", response_model=ROIRead, status_code=201)
async def evaluate_roi(
    project_id: int,
    payload: ROIInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra una evaluación ROI para el proyecto indicado."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if current_user.role not in ("admin", "superadmin") and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto.")

    evaluation = create_roi_evaluation(db, project_id, payload)
    assert evaluation.id is not None

    await ws_manager.broadcast(
        event_type="roi_evaluated",
        payload={
            "project_id":      project_id,
            "project_title":   project.title,
            "roi_pct":         evaluation.roi_pct,
            "payback_semanas": evaluation.payback_semanas,
            "cuadrante_roi":   evaluation.cuadrante_roi,
        },
    )

    return _to_read(evaluation)


@router.get("/plot", response_model=list[ROIPlotPoint])
def get_roi_plot(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Puntos para la matriz ROI (un punto por proyecto). Admin ve todos."""
    owner_id = None if current_user.role in ("admin", "superadmin") else current_user.id
    return get_roi_plot_points(db, owner_id=owner_id)


@router.get("/history/{project_id}", response_model=list[ROIRead])
def get_project_roi_history(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Historial completo de evaluaciones ROI de un proyecto."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if current_user.role not in ("admin", "superadmin") and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto.")

    return [_to_read(e) for e in get_roi_history(db, project_id)]


@router.get("/{project_id}", response_model=ROIRead | None)
def get_project_roi(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Última evaluación ROI de un proyecto. Devuelve null si no tiene."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if current_user.role not in ("admin", "superadmin") and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto.")

    latest = get_latest_roi(db, project_id)
    return _to_read(latest) if latest else None
