from fastapi import APIRouter, Depends
from typing import cast
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.services.dashboard_service import get_dashboard_stats, get_quadrant_summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Estadísticas del dashboard.
    - admin/superadmin → globales (todos los proyectos)
    - user             → personales (solo sus proyectos)
    """
    return get_dashboard_stats(
        db,
        user_id=cast(int, current_user.id),
        role=current_user.role,
    )


@router.get("/quadrant-summary")
def quadrant_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Distribución de proyectos por cuadrante.
    Respeta el mismo filtro de rol.
    """
    return get_quadrant_summary(
        db,
        user_id=cast(int, current_user.id),
        role=current_user.role,
    )
