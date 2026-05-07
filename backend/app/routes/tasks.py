# backend/app/routes/tasks.py
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.dependencies import get_current_user, get_db
from app.core.ws_manager import ws_manager
from app.models.project import Project
from app.models.task import TaskChecklist
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
import app.services.task_service as svc

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["Tasks"])


def _get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    return project


def _require_can_modify(project: Project, user: User, db: Session) -> None:
    if not svc.can_modify_tasks(db, project, user):
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para modificar tareas de este proyecto.",
        )


def _schedule_broadcast_progress(project_id: int, db: Session) -> None:
    progress = svc.calculate_progress(db, project_id)
    asyncio.create_task(
        ws_manager.broadcast(
            "project.progress_updated",
            {
                "project_id": project_id,
                "total_tasks": progress.total_tasks,
                "completed_tasks": progress.completed_tasks,
                "progress_pct": progress.progress_pct,
            },
        )
    )


@router.get("", response_model=list[TaskRead])
def list_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_project_or_404(project_id, db)
    return [svc.task_to_read(t) for t in svc.list_tasks(db, project_id)]


@router.get("/progress", response_model=ProjectProgress)
def get_progress(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_project_or_404(project_id, db)
    return svc.calculate_progress(db, project_id)


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    project_id: int,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _require_can_modify(project, current_user, db)
    task = svc.create_task(db, project_id, current_user, payload)
    await ws_manager.broadcast("task.created", svc.task_to_dict(task))
    _schedule_broadcast_progress(project_id, db)
    return svc.task_to_read(task)


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    project_id: int,
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _require_can_modify(project, current_user, db)
    task = svc.get_task(db, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")
    task = svc.update_task(db, task, payload, current_user)
    await ws_manager.broadcast("task.updated", svc.task_to_dict(task))
    _schedule_broadcast_progress(project_id, db)
    return svc.task_to_read(task)


@router.post("/{task_id}/complete", response_model=TaskRead)
async def complete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _require_can_modify(project, current_user, db)
    task = svc.get_task(db, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")
    task = svc.complete_task(db, task, current_user)
    await ws_manager.broadcast("task.updated", svc.task_to_dict(task))
    _schedule_broadcast_progress(project_id, db)
    return svc.task_to_read(task)


@router.post("/{task_id}/reopen", response_model=TaskRead)
async def reopen_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _require_can_modify(project, current_user, db)
    task = svc.get_task(db, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")
    task = svc.reopen_task(db, task)
    await ws_manager.broadcast("task.updated", svc.task_to_dict(task))
    _schedule_broadcast_progress(project_id, db)
    return svc.task_to_read(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _require_can_modify(project, current_user, db)
    task = svc.get_task(db, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")
    svc.delete_task(db, task)
    await ws_manager.broadcast(
        "task.deleted", {"id": task_id, "project_id": project_id}
    )
    _schedule_broadcast_progress(project_id, db)


@router.post(
    "/{task_id}/checklist",
    response_model=ChecklistItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_checklist(
    project_id: int,
    task_id: int,
    payload: ChecklistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _require_can_modify(project, current_user, db)
    task = svc.get_task(db, task_id)
    if not task or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="Tarea no encontrada.")
    item = svc.add_checklist_item(db, task_id, payload)
    task = svc.get_task(db, task_id)
    assert task is not None
    task = svc.sync_task_status_with_checklist(db, task, current_user)
    await ws_manager.broadcast(
        "checklist.updated", {"task_id": task_id, "project_id": project_id}
    )
    await ws_manager.broadcast("task.updated", svc.task_to_dict(task))
    _schedule_broadcast_progress(project_id, db)
    return ChecklistItemRead.model_validate(item)


@router.patch(
    "/{task_id}/checklist/{item_id}",
    response_model=ChecklistItemRead,
)
async def update_checklist(
    project_id: int,
    task_id: int,
    item_id: int,
    payload: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _require_can_modify(project, current_user, db)
    item = db.get(TaskChecklist, item_id)
    if not item or item.task_id != task_id:
        raise HTTPException(status_code=404, detail="Ítem no encontrado.")
    item = svc.update_checklist_item(db, item, payload)
    task = svc.get_task(db, task_id)
    assert task is not None
    task = svc.sync_task_status_with_checklist(db, task, current_user)
    await ws_manager.broadcast(
        "checklist.updated", {"task_id": task_id, "project_id": project_id}
    )
    await ws_manager.broadcast("task.updated", svc.task_to_dict(task))
    _schedule_broadcast_progress(project_id, db)
    return ChecklistItemRead.model_validate(item)


@router.delete(
    "/{task_id}/checklist/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_checklist(
    project_id: int,
    task_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = _get_project_or_404(project_id, db)
    _require_can_modify(project, current_user, db)
    item = db.get(TaskChecklist, item_id)
    if not item or item.task_id != task_id:
        raise HTTPException(status_code=404, detail="Ítem no encontrado.")
    svc.delete_checklist_item(db, item)
    task = svc.get_task(db, task_id)
    if task:
        task = svc.sync_task_status_with_checklist(db, task, current_user)
        await ws_manager.broadcast("task.updated", svc.task_to_dict(task))
    await ws_manager.broadcast(
        "checklist.updated", {"task_id": task_id, "project_id": project_id}
    )
    _schedule_broadcast_progress(project_id, db)
