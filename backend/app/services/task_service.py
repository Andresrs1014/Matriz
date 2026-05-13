# backend/app/services/task_service.py
from __future__ import annotations

from datetime import datetime, timezone

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
    """Superadmin en cualquier proyecto; el resto de roles solo en proyectos propios (owner_id).
    Además: miembros del equipo de desarrollo cuando el proyecto está asignado a dev."""
    if user.role == "superadmin":
        return True
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
    if task.status == "cancelada":
        return False
    if task.status == "completada":
        return True
    if items and all(i.is_done for i in items):
        return True
    return False


def checklists_for_task_ids(
    db: Session, task_ids: list[int]
) -> dict[int, list[TaskChecklist]]:
    if not task_ids:
        return {}
    rows = list(
        db.exec(
            select(TaskChecklist)
            .where(TaskChecklist.task_id.in_(task_ids))
            .order_by(TaskChecklist.task_id, TaskChecklist.sort_order, TaskChecklist.id)
        ).all()
    )
    out: dict[int, list[TaskChecklist]] = {}
    for r in rows:
        out.setdefault(r.task_id, []).append(r)
    return out


def list_task_rows(
    db: Session, project_id: int
) -> list[tuple[ProjectTask, list[TaskChecklist]]]:
    tasks = list(
        db.exec(
            select(ProjectTask)
            .where(ProjectTask.project_id == project_id)
            .order_by(ProjectTask.sort_order, ProjectTask.created_at)
        ).all()
    )
    ids = [t.id for t in tasks if t.id is not None]
    by_task = checklists_for_task_ids(db, ids)
    return [(t, by_task.get(t.id or -1, [])) for t in tasks]


def get_task_checklists(db: Session, task_id: int) -> list[TaskChecklist]:
    return list(
        db.exec(
            select(TaskChecklist)
            .where(TaskChecklist.task_id == task_id)
            .order_by(TaskChecklist.sort_order, TaskChecklist.id)
        ).all()
    )


def calculate_progress(db: Session, project_id: int) -> ProjectProgress:
    tasks = list(
        db.exec(select(ProjectTask).where(ProjectTask.project_id == project_id)).all()
    )
    # Las canceladas no cuentan en el denominador del OKR.
    active = [t for t in tasks if t.status != "cancelada"]
    total = len(active)
    if total == 0:
        return ProjectProgress(
            project_id=project_id,
            total_tasks=0,
            completed_tasks=0,
            progress_pct=0.0,
        )
    ids = [t.id for t in active if t.id is not None]
    by_task = checklists_for_task_ids(db, ids)
    completed = sum(
        1 for t in active if _task_rows_done(t, by_task.get(t.id or -1, []))
    )
    pct = round((completed / total) * 100, 1)
    return ProjectProgress(
        project_id=project_id,
        total_tasks=total,
        completed_tasks=completed,
        progress_pct=pct,
    )


def get_task(db: Session, task_id: int) -> ProjectTask | None:
    return db.get(ProjectTask, task_id)


def task_to_read(task: ProjectTask, items: list[TaskChecklist]) -> TaskRead:
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
    assert task.id is not None
    for i, item in enumerate(payload.checklist_items):
        ci = TaskChecklist(
            task_id=task.id,
            text=item.text,
            sort_order=item.sort_order if item.sort_order else i,
        )
        db.add(ci)
    db.commit()
    db.refresh(task)
    return task


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
    db.refresh(task)
    return task


def complete_task(db: Session, task: ProjectTask, user: User) -> ProjectTask:
    task.status = "completada"
    task.completed_at = datetime.now(timezone.utc)
    task.completed_by = user.id
    task.updated_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def reopen_task(db: Session, task: ProjectTask) -> ProjectTask:
    task.status = "pendiente"
    task.completed_at = None
    task.completed_by = None
    task.updated_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task: ProjectTask) -> None:
    assert task.id is not None
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
    assert task.id is not None
    if task.status == "cancelada":
        db.refresh(task)
        return task
    items = list(
        db.exec(
            select(TaskChecklist).where(TaskChecklist.task_id == task.id)
        ).all()
    )
    if not items:
        db.refresh(task)
        return task
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
    db.refresh(task)
    return task


def task_to_dict(task: ProjectTask, items: list[TaskChecklist]) -> dict:
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
