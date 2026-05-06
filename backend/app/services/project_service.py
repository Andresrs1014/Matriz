# backend/app/services/project_service.py
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlmodel import Session, select, col

from app.models.project import Project
from app.models.user import User


# ── Flujo de estados ──────────────────────────────────────────────────────────
# pendiente_revision → escalado → preguntas_asignadas → en_evaluacion
#   → evaluado → pendiente_salario → calculando_roi → aprobado_final
#
# Actor por paso:
#   pendiente_revision  → admin escala
#   escalado            → superadmin aprueba + asigna preguntas
#   preguntas_asignadas → admin inicia evaluación
#   en_evaluacion       → admin marca como evaluado (luego de llenar matrix)
#   evaluado            → superadmin provee salario
#   pendiente_salario   → admin llena horas/personas → dispara cálculo ROI
#   calculando_roi      → sistema marca aprobado_final automáticamente
#   rechazado           → estado terminal, cualquier rol con permiso puede rechazar

VALID_TRANSITIONS: dict[str, list[str]] = {
    "pendiente_revision":  ["escalado",             "rechazado"],
    "escalado":            ["preguntas_asignadas",  "rechazado"],
    "preguntas_asignadas": ["en_evaluacion",        "rechazado"],
    "en_evaluacion":       ["evaluado",             "rechazado"],
    "evaluado":            ["pendiente_salario",    "rechazado"],
    "pendiente_salario":   ["calculando_roi",       "rechazado"],
    "calculando_roi":      ["aprobado_final",       "rechazado"],
    "aprobado_final":      [],
    "rechazado":           [],
}


def _assert_transition(current: str, next_status: str) -> None:
    allowed = VALID_TRANSITIONS.get(current, [])
    if next_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transición inválida: '{current}' → '{next_status}'. Permitidas: {allowed}",
        )


# ── Queries ───────────────────────────────────────────────────────────────────

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


# ── CRUD ──────────────────────────────────────────────────────────────────────

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

def escalar_proyecto(db: Session, project: Project, admin: User) -> Project:
    """Admin escala el proyecto al superadmin → pendiente_revision → escalado."""
    _assert_transition(project.status, "escalado")
    project.status = "escalado"
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def superaprobar_proyecto(db: Session, project: Project, superadmin: User) -> Project:
    """Superadmin aprueba + asigna preguntas → escalado → preguntas_asignadas."""
    _assert_transition(project.status, "preguntas_asignadas")
    project.status = "preguntas_asignadas"
    project.approved_by = superadmin.id
    project.approved_at = datetime.now(timezone.utc)
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def iniciar_evaluacion(db: Session, project: Project) -> Project:
    """Admin inicia evaluación con las preguntas asignadas → preguntas_asignadas → en_evaluacion."""
    _assert_transition(project.status, "en_evaluacion")
    project.status = "en_evaluacion"
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def marcar_evaluado(db: Session, project: Project) -> Project:
    """Admin completa matrix impacto/esfuerzo → en_evaluacion → evaluado."""
    _assert_transition(project.status, "evaluado")
    project.status = "evaluado"
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def registrar_salario(db: Session, project: Project) -> Project:
    """Superadmin provee salario → evaluado → pendiente_salario."""
    _assert_transition(project.status, "pendiente_salario")
    project.status = "pendiente_salario"
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def iniciar_calculo_roi(db: Session, project: Project) -> Project:
    """Admin llena horas/personas → pendiente_salario → calculando_roi."""
    _assert_transition(project.status, "calculando_roi")
    project.status = "calculando_roi"
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def aprobacion_final(db: Session, project: Project, admin: User) -> Project:
    """Sistema cierra el flujo → calculando_roi → aprobado_final."""
    _assert_transition(project.status, "aprobado_final")
    project.status = "aprobado_final"
    project.final_approved_by = admin.id
    project.final_approved_at = datetime.now(timezone.utc)
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def rechazar_proyecto(db: Session, project: Project, user: User) -> Project:
    """Cualquier actor con permiso puede rechazar en cualquier paso del flujo."""
    _assert_transition(project.status, "rechazado")
    project.status = "rechazado"
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
