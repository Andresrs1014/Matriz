from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlmodel import Session, select, col
from app.models.project import Project
from app.models.user import User

# Flujo corregido con estado escalado
VALID_TRANSITIONS: dict[str, list[str]] = {
    "pendiente_revision": ["escalado"],
    "escalado":           ["aprobado"],
    "aprobado":           ["en_evaluacion"],
    "en_evaluacion":      ["evaluado"],
    "evaluado":           ["aprobado_final"],
    "aprobado_final":     [],
}

def _assert_transition(current: str, next_status: str) -> None:
    allowed = VALID_TRANSITIONS.get(current, [])
    if next_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transición inválida: '{current}' → '{next_status}'. Permitidas: {allowed}"
        )

def list_projects(db: Session, owner_id: int) -> list[Project]:
    return list(db.exec(
        select(Project)
        .where(Project.owner_id == owner_id)
        .order_by(col(Project.updated_at).desc())
    ))

def list_all_projects(db: Session) -> list[Project]:
    return list(db.exec(select(Project).order_by(col(Project.updated_at).desc())))

def get_project(db: Session, project_id: int, owner_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project or project.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")
    return project

def get_project_any(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")
    return project

def create_project(db: Session, owner_id: int, data: dict) -> Project:
    project = Project(owner_id=owner_id, **data)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

def update_project(db: Session, project: Project, data: dict) -> Project:
    for k, v in data.items():
        setattr(project, k, v)
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

def delete_project(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()

# ── Acciones del flujo ────────────────────────────────────────────────────────

def escalar_proyecto(db: Session, project: Project, coordinador: User) -> Project:
    """Coordinador revisa el OKR y lo eleva al admin → pendiente_revision → escalado."""
    _assert_transition(project.status, "escalado")
    project.status     = "escalado"
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

def aprobar_proyecto(db: Session, project: Project, admin: User) -> Project:
    """Admin aprueba el proyecto → escalado → aprobado."""
    _assert_transition(project.status, "aprobado")
    project.status      = "aprobado"
    project.approved_by = admin.id
    project.approved_at = datetime.now(timezone.utc)
    project.updated_at  = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

def iniciar_evaluacion(db: Session, project: Project) -> Project:
    """Admin genera paquete de preguntas → aprobado → en_evaluacion."""
    _assert_transition(project.status, "en_evaluacion")
    project.status     = "en_evaluacion"
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

def marcar_evaluado(db: Session, project: Project) -> Project:
    """Coordinador completó evaluación operacional → en_evaluacion → evaluado."""
    _assert_transition(project.status, "evaluado")
    project.status     = "evaluado"
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

def aprobacion_final(db: Session, project: Project, admin: User) -> Project:
    """Admin da aprobación final → evaluado → aprobado_final."""
    _assert_transition(project.status, "aprobado_final")
    project.status            = "aprobado_final"
    project.final_approved_by = admin.id
    project.final_approved_at = datetime.now(timezone.utc)
    project.updated_at        = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
