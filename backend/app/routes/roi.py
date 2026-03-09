from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.roi import ROIParte1Input, ROIParte2Input, ROIRead, ROIPlotPoint, SEDES
from app.services.roi_service import (
    create_roi_parte1, update_roi_parte2, get_latest_roi, get_roi_plot_points
)

router = APIRouter(prefix="/roi", tags=["roi"])


@router.get("/sedes", response_model=list[str])
def get_sedes():
    """Retorna las sedes disponibles para el formulario."""
    return SEDES


@router.get("/plot/all", response_model=list[ROIPlotPoint])
def get_roi_plot(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Todos los proyectos con ROI completo para pintar la matriz."""
    return get_roi_plot_points(db)


@router.post("/{project_id}/parte1", response_model=ROIRead)
def submit_parte1(
    project_id: int,
    data: ROIParte1Input,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Parte 1 — la llena el jefe. Guarda datos económicos y calcula valor hora hombre."""
    if data.sede not in SEDES:
        raise HTTPException(status_code=422, detail=f"Sede inválida. Opciones: {SEDES}")
    return create_roi_parte1(db, project_id, data)


@router.patch("/{project_id}/parte2", response_model=ROIRead)
def submit_parte2(
    project_id: int,
    data: ROIParte2Input,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Parte 2 — la llena el analista. Recalcula ROI con horas proyectadas."""
    existing = get_latest_roi(db, project_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Primero complete la Parte 1 del ROI")
    if data.horas_proyectadas >= data.horas_proceso_actual:
        raise HTTPException(
            status_code=422,
            detail="Las horas proyectadas deben ser menores a las actuales"
        )
    parte1 = ROIParte1Input(
        cargo=existing.cargo,
        sede=existing.sede,
        num_personas=existing.num_personas,
        salario_base=existing.salario_base,
    )
    return update_roi_parte2(db, existing, parte1, data)


@router.get("/{project_id}", response_model=ROIRead | None)
def get_roi(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Última evaluación ROI de un proyecto. Devuelve null si no tiene."""
    return get_latest_roi(db, project_id)

@router.get("/history/{project_id}", response_model=list[ROIRead])
def get_history(
    project_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    from app.services.roi_service import get_roi_history
    return get_roi_history(db, project_id)

