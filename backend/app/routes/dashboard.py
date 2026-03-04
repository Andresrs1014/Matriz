from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.matrix import QuadrantSummary
from app.services.dashboard_service import get_dashboard_stats, get_quadrant_summary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    KPIs del dashboard: total proyectos, evaluados, pendientes,
    total evaluaciones y distribución por cuadrante.
    """
    return get_dashboard_stats(db, owner_email=current_user.email)


@router.get("/quadrant-summary", response_model=list[QuadrantSummary])
def quadrant_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Proyectos agrupados por cuadrante con nombre y conteo."""
    return get_quadrant_summary(db, owner_email=current_user.email)
