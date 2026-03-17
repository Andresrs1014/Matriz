# backend/app/routes/roi.py
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from app.core.dependencies import get_db, get_current_user, require_admin, require_superadmin
from app.models.user import User
from app.schemas.roi import ROIParte1Input, ROIParte2Input, ROIRead, ROIPlotPoint, SEDES
from app.services.roi_service import (
    create_roi_parte1, update_roi_parte2,
    get_latest_roi, get_roi_plot_points, get_roi_history,
)

router = APIRouter(prefix="/roi", tags=["roi"])

# ── 1. Rutas estáticas PRIMERO ──────────────────────────────────────────────

@router.get("/sedes", response_model=list[str])
def get_sedes():
    return SEDES

@router.get("/plot/all", response_model=list[ROIPlotPoint])
def get_roi_plot(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "usuario":
        raise HTTPException(status_code=403, detail="Sin acceso al ROI calculado.")
    return get_roi_plot_points(db)

# ── 2. Rutas con {project_id} DESPUÉS ──────────────────────────────────────

@router.post("/{project_id}/parte1", response_model=ROIRead)
def submit_parte1(
    project_id: int,
    data: ROIParte1Input,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    if data.sede not in SEDES:
        raise HTTPException(status_code=422, detail=f"Sede inválida. Opciones: {SEDES}")
    existing = get_latest_roi(db, project_id)
    if existing and existing.horas_proceso_actual == 0.0:
        raise HTTPException(status_code=400, detail="El salario ya fue registrado para este proyecto.")
    return create_roi_parte1(db, project_id, data)

@router.patch("/{project_id}/parte2", response_model=ROIRead)
def submit_parte2(
    project_id: int,
    data: ROIParte2Input,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = get_latest_roi(db, project_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Primero el superadmin debe completar la Parte 1 del ROI.")
    if data.horas_proyectadas >= data.horas_proceso_actual:
        raise HTTPException(status_code=422, detail="Las horas proyectadas deben ser menores a las horas actuales del proceso.")
    parte1 = ROIParte1Input(
        cargo=existing.cargo,
        sede=existing.sede,
        num_personas=existing.num_personas,
        salario_base=existing.salario_base,
    )
    return update_roi_parte2(db, existing, parte1, data)

@router.get("/history/{project_id}", response_model=list[ROIRead])
def get_history(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "usuario":
        raise HTTPException(status_code=403, detail="Sin acceso al historial ROI.")
    return get_roi_history(db, project_id)

@router.get("/{project_id}", response_model=ROIRead | None)
def get_roi(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "usuario":
        raise HTTPException(status_code=403, detail="Sin acceso al ROI calculado.")
    return get_latest_roi(db, project_id)
