# backend/app/services/task_service.py
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.models.dev_team import DevTeamMember
from app.models.project import Project
from app.models.task import ProjectTask, TaskChecklist
from app.models.user import User
from app.schemas.task import (
    ChecklistItemCreate,
    ChecklistItemRead,
    ChecklistItemUpdate,
    ProjectProgress,
    TaskCreate,
    TaskRead,
    TaskUpdate,
)


def can_modify_tasks(db: Session, project: Project, user: User) -> bool:
    """Owner o miembro del equipo de desarrollo si el proyecto está asignado a dev.
    admin, superadmin y coordinador: solo lectura (sin modificar tareas)."""
    if user.role in ("admin", "superadmin", "coordinador"):
        return False
    if project.owner_id == user.id:
        return True
    if project.assigned_to_dev:
        member = db.exec(
            select(DevTeamMember).where(DevTeamMember.user_id == user.id)
        ).first()
        if member:
            return True
    return False


def _task_rows_done(task: ProjectTask, items: list[TaskChecklist]) -> bool:
    if task.status == "completada":
        return True
    if items and all(i.is_done for i in items):
        return True
    return False


def calculate_progress(db: Session, project_id: int) -> ProjectProgress:
    stmt = (
        select(ProjectTask)
        .where(ProjectTask.project_id == project_id)
        .options(selectinload(ProjectTask.checklist_items))
    )
    tasks = list(db.exec(stmt).all())
    total = len(tasks)
    if total == 0:
        return ProjectProgress(
            project_id=project_id,
            total_tasks=0,
            completed_tasks=0,
            progress_pct=0.0,
        )
    completed = sum(
        1 for t in tasks if _task_rows_done(t, list(t.checklist_items or []))
    )
    pct = round((completed / total) * 100, 1)
    return ProjectProgress(
        project_id=project_id,
        total_tasks=total,
        completed_tasks=completed,
        progress_pct=pct,
    )


def list_tasks(db: Session, project_id: int) -> list[ProjectTask]:
    return list(
        db.exec(
            select(ProjectTask)
            .where(ProjectTask.project_id == project_id)
            .options(selectinload(ProjectTask.checklist_items))
            .order_by(ProjectTask.sort_order, ProjectTask.created_at)
        ).all()
    )


def get_task(db: Session, task_id: int) -> ProjectTask | None:
    return db.exec(
        select(ProjectTask)
        .where(ProjectTask.id == task_id)
        .options(selectinload(ProjectTask.checklist_items))
    ).first()


def task_to_read(task: ProjectTask) -> TaskRead:
    items = list(task.checklist_items or [])
    return TaskRead(
        id=task.id,  # type: ignore[arg-type]
        project_id=task.project_id,
        created_by=task.created_by,
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        due_date=task.due_date,
        sort_order=task.sort_order,
        evidence_hint=task.evidence_hint,
        completed_at=task.completed_at,
        completed_by=task.completed_by,
        created_at=task.created_at,
        updated_at=task.updated_at,
        checklist_items=[ChecklistItemRead.model_validate(i) for i in items],
        checklist_total=len(items),
        checklist_done=sum(1 for i in items if i.is_done),
    )


def create_task(db: Session, project_id: int, user: User, payload: TaskCreate) -> ProjectTask:
    task = ProjectTask(
        project_id=project_id,
        created_by=user.id,  # type: ignore[arg-type]
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        due_date=payload.due_date,
        sort_order=payload.sort_order,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    for i, item in enumerate(payload.checklist_items):
        ci = TaskChecklist(
            task_id=task.id,  # type: ignore[arg-type]
            text=item.text,
            sort_order=item.sort_order if item.sort_order else i,
        )
        db.add(ci)
    db.commit()
    return get_task(db, task.id)  # type: ignore[arg-type]


def update_task(db: Session, task: ProjectTask, payload: TaskUpdate, actor: User) -> ProjectTask:
    prev = task.status
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(task, k, v)

    if data.get("status") == "completada" and prev != "completada":
        task.completed_at = datetime.now(timezone.utc)
        task.completed_by = actor.id
    if "status" in data and data["status"] != "completada":
        task.completed_at = None
        task.completed_by = None

    task.updated_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    refreshed = get_task(db, task.id)  # type: ignore[arg-type]
    assert refreshed is not None
    return refreshed


def complete_task(db: Session, task: ProjectTask, user: User) -> ProjectTask:
    task.status = "completada"
    task.completed_at = datetime.now(timezone.utc)
    task.completed_by = user.id
    task.updated_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    out = get_task(db, task.id)  # type: ignore[arg-type]
    assert out is not None
    return out


def reopen_task(db: Session, task: ProjectTask) -> ProjectTask:
    task.status = "pendiente"
    task.completed_at = None
    task.completed_by = None
    task.updated_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    out = get_task(db, task.id)  # type: ignore[arg-type]
    assert out is not None
    return out


def delete_task(db: Session, task: ProjectTask) -> None:
    items = db.exec(
        select(TaskChecklist).where(TaskChecklist.task_id == task.id)
    ).all()
    for item in items:
        db.delete(item)
    db.delete(task)
    db.commit()


def add_checklist_item(db: Session, task_id: int, payload: ChecklistItemCreate) -> TaskChecklist:
    item = TaskChecklist(
        task_id=task_id, text=payload.text, sort_order=payload.sort_order
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_checklist_item(
    db: Session, item: TaskChecklist, payload: ChecklistItemUpdate
) -> TaskChecklist:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(item, k, v)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_checklist_item(db: Session, item: TaskChecklist) -> None:
    db.delete(item)
    db.commit()


def sync_task_status_with_checklist(
    db: Session, task: ProjectTask, acting_user: User
) -> ProjectTask:
    items = list(
        db.exec(
            select(TaskChecklist).where(TaskChecklist.task_id == task.id)
        ).all()
    )
    if not items:
        refreshed = get_task(db, task.id)  # type: ignore[arg-type]
        assert refreshed is not None
        return refreshed
    all_done = all(i.is_done for i in items)
    if all_done:
        if task.status != "completada":
            task.status = "completada"
            task.completed_at = datetime.now(timezone.utc)
            task.completed_by = acting_user.id
    else:
        if task.status == "completada":
            task.status = "en_progreso"
            task.completed_at = None
            task.completed_by = None
    task.updated_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    out = get_task(db, task.id)  # type: ignore[arg-type]
    assert out is not None
    return out


def task_to_dict(task: ProjectTask) -> dict:
    items = list(task.checklist_items or [])
    return {
        "id": task.id,
        "project_id": task.project_id,
        "title": task.title,
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "checklist_total": len(items),
        "checklist_done": sum(1 for i in items if i.is_done),
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }
