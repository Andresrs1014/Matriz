from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, col
from datetime import datetime, timezone
from app.core.dependencies import get_db, get_current_user, require_admin, require_coordinador
from app.models.project import Project
from app.models.user import User
from app.models.roi import ROIEvaluation
from app.schemas.project import ProjectCreate, ProjectRead, AprobacionFinalInput
from app.services.project_service import (
    get_project_any, create_project, delete_project,
    aprobar_proyecto, iniciar_evaluacion, marcar_evaluado, aprobacion_final,
    list_all_projects,
)
from app.services.comment_service import create_status_comment
from app.services.roi_service import _calcular_valor_hora
from app.core.ws_manager import ws_manager

router = APIRouter(prefix="/projects", tags=["Projects"])


def _to_read(p: Project) -> ProjectRead:
    assert p.id is not None
    return ProjectRead(
        id=p.id,
        title=p.title,
        description=p.description,
        status=p.status,
        source=p.source,
        owner_id=p.owner_id,
        ms_list_id=p.ms_list_id,
        approved_by=p.approved_by,
        approved_at=p.approved_at,
        final_approved_by=p.final_approved_by,
        final_approved_at=p.final_approved_at,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


# ── CRUD base ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role in ("admin", "superadmin", "coordinador"):
        projects = list_all_projects(db)
    else:
        projects = list(db.exec(
            select(Project)
            .where(Project.owner_id == current_user.id)
            .order_by(col(Project.created_at).desc())
        ).all())
    return [_to_read(p) for p in projects]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project_endpoint(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assert current_user.id is not None
    project = Project(
        title=payload.title,
        description=payload.description,
        owner_id=current_user.id,
        source="manual",
        status="pendiente_revision",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    await ws_manager.broadcast(
        event_type="project.created",
        payload={"id": project.id, "title": project.title},
    )
    return _to_read(project)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if current_user.role not in ("admin", "superadmin", "coordinador") and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto.")
    return _to_read(project)


@router.delete("/{project_id}")
def delete_project_endpoint(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    if current_user.role not in ("admin", "superadmin") and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto.")
    delete_project(db, project)
    return {"ok": True}


# ── Flujo de aprobación ───────────────────────────────────────────────────────

@router.post("/{project_id}/aprobar", response_model=ProjectRead)
def aprobar(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Paso 1 — Admin aprueba el proyecto."""
    project = get_project_any(db, project_id)
    project = aprobar_proyecto(db, project, current_user)
    create_status_comment(db, project_id, current_user,
        f"Proyecto aprobado por {current_user.full_name or current_user.email}.")
    return _to_read(project)


@router.post("/{project_id}/iniciar-evaluacion", response_model=ProjectRead)
def iniciar_eval(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Paso 2 — Admin genera el paquete de preguntas y lo manda al coordinador."""
    project = get_project_any(db, project_id)
    project = iniciar_evaluacion(db, project)
    create_status_comment(db, project_id, current_user,
        f"Paquete de preguntas generado por {current_user.full_name or current_user.email}. En evaluacion.")
    return _to_read(project)


@router.post("/{project_id}/marcar-evaluado", response_model=ProjectRead)
def marcar_eval(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_coordinador),
):
    """Paso 3 — Coordinador completa la evaluación operacional."""
    project = get_project_any(db, project_id)
    project = marcar_evaluado(db, project)
    create_status_comment(db, project_id, current_user,
        f"Evaluacion completada por {current_user.full_name or current_user.email}.")
    return _to_read(project)


@router.post("/{project_id}/aprobacion-final", response_model=ProjectRead)
def aprobacion_final_endpoint(
    project_id: int,
    payload: AprobacionFinalInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Paso 4 — Admin da aprobación final.
    Recibe encuesta (salario, cargo) → crea ROI Parte 1 automáticamente.
    """
    project = get_project_any(db, project_id)
    project = aprobacion_final(db, project, current_user)

    # Crear ROI Parte 1 automáticamente con los datos de la encuesta
    valores = _calcular_valor_hora(payload.salario_base)
    roi = ROIEvaluation(
        project_id         = project_id,
        cargo              = payload.cargo,
        sede               = payload.sede or "No especificada",
        num_personas       = payload.num_personas,
        salario_base       = payload.salario_base,
        valor_quincena     = valores["valor_quincena"],
        valor_dia          = valores["valor_dia"],
        valor_hora_hombre  = valores["valor_hora_hombre"],
    )
    db.add(roi)
    db.commit()

    obs = payload.observacion or "Sin observaciones."
    create_status_comment(db, project_id, current_user,
        f"Aprobacion final por {current_user.full_name or current_user.email}. "
        f"Cargo: {payload.cargo} | Salario base registrado. {obs}")

    return _to_read(project)
