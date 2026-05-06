# Plan de Implementación — Matriz: Tareas con Progreso + Asignación por Área
> Para Cursor Composer 2 (agent mode)
> Leer `rules.md` COMPLETO antes de tocar cualquier archivo.
> Este plan se ejecuta DESPUÉS de haber aplicado `plan-matriz-mejoras.md`.

---

## CONTEXTO OBLIGATORIO — LEE ESTO PRIMERO

El proyecto Matriz ya tiene implementado:
- `WorkArea` y `WorkSite` como modelos de catálogo (`backend/app/models/work_catalog.py`)
- `User.work_area_id` FK a `WorkArea`
- `Project.assigned_to_dev` + `assigned_to_dev_at` + `assigned_to_dev_by` (plan anterior)
- `DevTeamMember` para el equipo de desarrollo
- `email_service.py` con `aiosmtplib` para notificaciones
- WebSocket via `ws_manager.broadcast(event_type, payload)`
- Migraciones manuales en `run_migrations()` de `database.py` — NUNCA Alembic

**Reglas de arquitectura que DEBES respetar (sin excepción):**
1. Lógica de negocio → `backend/app/services/`
2. Routes → solo orquestan (validar → service → responder)
3. Columnas nuevas en tablas existentes → `run_migrations()` en `database.py`
4. Modelos nuevos → registrar en `backend/app/models/__init__.py`
5. Cambios de estado → `create_status_comment()` de `comment_service.py`
6. WebSocket → `await ws_manager.broadcast(event_type, payload)`
7. Email → `asyncio.create_task()` para no bloquear HTTP response
8. Lee `rules.md` primero

---

## FEATURES A IMPLEMENTAR

### Feature A — Asignación de proyecto a área (reemplaza/extiende `assigned_to_dev`)
### Feature B — Tareas del proyecto con subtareas (checklist)
### Feature C — Barra de progreso del OKR basada en tareas completadas
### Feature D — WebSocket en tiempo real para progreso

---

## DECISIONES DE DISEÑO (no las cambies)

**Asignación por área:**
- El usuario (`owner`) puede asignar el proyecto a **su propio área** (`user.work_area_id`)
- El `superadmin` puede asignar a **cualquier área** del catálogo
- `assigned_to_dev` del plan anterior se mantiene como está — la asignación de área es un campo separado (`assigned_area_id`) que coexiste
- Al asignar a un área, se notifica por email a todos los usuarios que pertenecen a esa área (via `User.work_area_id`)
- El área asignada se muestra como badge en el detalle del proyecto

**Tareas:**
- Modelo `ProjectTask`: título, descripción, prioridad, fecha límite, estado, orden
- Modelo `TaskChecklist`: ítems de subtarea dentro de una tarea
- El progreso global = `(tareas completadas / total tareas) * 100`
- Si una tarea tiene checklist, ella misma se considera "completada" solo cuando todos sus ítems están marcados — O — cuando el creador la marca manualmente como completada (ambas vías válidas)
- El progreso se recalcula en el backend cada vez que cambia una tarea o checklist y se broadcastea por WebSocket
- No afecta el state machine del proyecto — es puramente informativo

**Permisos de tareas:**
- Crear tareas: `owner` del proyecto + miembros del `DevTeamMember` (cuando `assigned_to_dev = true`)
- Completar/editar tareas: mismo grupo anterior
- `admin` y `superadmin`: solo lectura de tareas (ven todo, no modifican)
- Las tareas son visibles para todos los que tienen acceso al proyecto

---

## FASE 0 — Actualizar `.cursorrules`

Agregar al archivo `.cursorrules` existente en la raíz:

```
## Nuevos patrones (plan tareas + áreas)
- Modelo ProjectTask: backend/app/models/task.py
- Modelo TaskChecklist: mismo archivo que ProjectTask
- Service de tareas: backend/app/services/task_service.py
- Route de tareas: backend/app/routes/tasks.py
- Progreso se calcula SIEMPRE en task_service, nunca en routes ni frontend
- WebSocket events nuevos: task.created, task.updated, task.deleted,
  checklist.updated, project.progress_updated, project.area_assigned
- assigned_area_id en Project es FK a WorkArea — coexiste con assigned_to_dev
```

---

## FASE 1 — Backend: Modelos nuevos

### 1.1 — Modelos `ProjectTask` y `TaskChecklist`

**Archivo nuevo:** `backend/app/models/task.py`

```python
# backend/app/models/task.py
from __future__ import annotations
from datetime import datetime, timezone, date
from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship


class TaskChecklist(SQLModel, table=True):
    """Ítem de subtarea dentro de una tarea."""
    __tablename__ = "taskchecklist"

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(foreign_key="projecttask.id", nullable=False, index=True)
    text: str = Field(max_length=500, nullable=False)
    is_done: bool = Field(default=False, nullable=False)
    sort_order: int = Field(default=0, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

    task: Optional["ProjectTask"] = Relationship(back_populates="checklist_items")


class ProjectTask(SQLModel, table=True):
    """Tarea asociada a un proyecto OKR."""
    __tablename__ = "projecttask"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", nullable=False, index=True)
    created_by: int = Field(foreign_key="user.id", nullable=False)

    title: str = Field(max_length=300, nullable=False)
    description: Optional[str] = Field(default=None)

    # Prioridad: urgente | alta | media | baja
    priority: str = Field(default="media", max_length=20, nullable=False)

    # Estado: pendiente | en_progreso | completada
    status: str = Field(default="pendiente", max_length=30, nullable=False)

    due_date: Optional[date] = Field(default=None)

    sort_order: int = Field(default=0, nullable=False)

    # Hint de evidencia — mensaje informativo, no obliga a subir archivo
    evidence_hint: str = Field(
        default="Al completar esta tarea, adjunta evidencia en el panel de evidencias del proyecto (opcional).",
        max_length=500,
        nullable=False
    )

    completed_at: Optional[datetime] = Field(default=None)
    completed_by: Optional[int] = Field(default=None, foreign_key="user.id")

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

    checklist_items: List[TaskChecklist] = Relationship(back_populates="task")
```

### 1.2 — Columna `assigned_area_id` en `Project`

**Archivo a modificar:** `backend/app/models/project.py`

Agregar después de los campos `assigned_to_dev_*`:

```python
# Asignación a área funcional (WorkArea)
assigned_area_id: Optional[int] = Field(
    default=None, nullable=True, foreign_key="workarea.id"
)
assigned_area_at: Optional[datetime] = Field(default=None, nullable=True)
assigned_area_by: Optional[int] = Field(default=None, nullable=True)  # user.id quien asignó
```

### 1.3 — Registrar modelos en `__init__.py`

**Archivo a modificar:** `backend/app/models/__init__.py`

Agregar:
```python
from app.models.task import ProjectTask, TaskChecklist
```

Agregar a `__all__`:
```python
"ProjectTask",
"TaskChecklist",
```

### 1.4 — Migraciones en `database.py`

**Archivo a modificar:** `backend/app/database.py`

Agregar al final del array `migrations` en `run_migrations()`:

```python
# ── Feature: Asignación por área ───────────────────────────────────────────
("project.assigned_area_id",
 "ALTER TABLE project ADD COLUMN assigned_area_id INTEGER REFERENCES workarea(id)"),
("project.assigned_area_at",
 "ALTER TABLE project ADD COLUMN assigned_area_at DATETIME"),
("project.assigned_area_by",
 "ALTER TABLE project ADD COLUMN assigned_area_by INTEGER"),
```

> NOTA: Las tablas `projecttask` y `taskchecklist` son nuevas — las crea `create_all()` en el lifespan. No necesitan entrada en `run_migrations()`.

---

## FASE 2 — Backend: Schemas

### 2.1 — Schemas de tareas

**Archivo nuevo:** `backend/app/schemas/task.py`

```python
# backend/app/schemas/task.py
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, Field


# ── Checklist ────────────────────────────────────────────────────────────────

class ChecklistItemRead(BaseModel):
    id: int
    task_id: int
    text: str
    is_done: bool
    sort_order: int
    model_config = {"from_attributes": True}

class ChecklistItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    sort_order: int = 0

class ChecklistItemUpdate(BaseModel):
    text: Optional[str] = Field(default=None, max_length=500)
    is_done: Optional[bool] = None
    sort_order: Optional[int] = None


# ── Tasks ────────────────────────────────────────────────────────────────────

Priority = Literal["urgente", "alta", "media", "baja"]
TaskStatus = Literal["pendiente", "en_progreso", "completada"]

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    priority: Priority = "media"
    due_date: Optional[date] = None
    sort_order: int = 0
    checklist_items: list[ChecklistItemCreate] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=300)
    description: Optional[str] = None
    priority: Optional[Priority] = None
    due_date: Optional[date] = None
    status: Optional[TaskStatus] = None
    sort_order: Optional[int] = None

class TaskRead(BaseModel):
    id: int
    project_id: int
    created_by: int
    title: str
    description: Optional[str]
    priority: str
    status: str
    due_date: Optional[date]
    sort_order: int
    evidence_hint: str
    completed_at: Optional[datetime]
    completed_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    checklist_items: list[ChecklistItemRead] = []
    # Campos calculados
    checklist_total: int = 0
    checklist_done: int = 0
    model_config = {"from_attributes": True}


# ── Progreso del proyecto ─────────────────────────────────────────────────────

class ProjectProgress(BaseModel):
    project_id: int
    total_tasks: int
    completed_tasks: int
    progress_pct: float   # 0.0 – 100.0, redondeado a 1 decimal
```

### 2.2 — Schemas de asignación por área

**Archivo a modificar:** `backend/app/schemas/project.py`

Agregar a `ProjectRead`:
```python
assigned_area_id: int | None = None
assigned_area_at: datetime | None = None
assigned_area_by: int | None = None
assigned_area_name: str | None = None   # se llena en el service, join con WorkArea
```

Agregar schema nuevo al final del archivo:
```python
class AssignAreaInput(BaseModel):
    area_id: int   # ID de WorkArea
```

---

## FASE 3 — Backend: Services

### 3.1 — Service de tareas

**Archivo nuevo:** `backend/app/services/task_service.py`

```python
# backend/app/services/task_service.py
from datetime import datetime, timezone
from sqlmodel import Session, select
from app.models.task import ProjectTask, TaskChecklist
from app.models.project import Project
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, ChecklistItemCreate, ChecklistItemUpdate, ProjectProgress


# ── Permisos ─────────────────────────────────────────────────────────────────

def can_modify_tasks(db: Session, project: Project, user: User) -> bool:
    """
    Puede modificar tareas si:
    - Es el owner del proyecto, O
    - Es superadmin, O
    - El proyecto está asignado a desarrollo (assigned_to_dev=True) y el usuario
      está en DevTeamMember
    """
    if project.owner_id == user.id:
        return True
    if user.role == "superadmin":
        return True
    if project.assigned_to_dev:
        from app.models.dev_team import DevTeamMember
        member = db.exec(
            select(DevTeamMember).where(DevTeamMember.user_id == user.id)
        ).first()
        if member:
            return True
    return False


# ── Progreso ──────────────────────────────────────────────────────────────────

def calculate_progress(db: Session, project_id: int) -> ProjectProgress:
    """
    Calcula el progreso del proyecto basado en tareas completadas.
    Una tarea cuenta como completada si status == 'completada'.
    """
    tasks = db.exec(
        select(ProjectTask).where(ProjectTask.project_id == project_id)
    ).all()

    total = len(tasks)
    if total == 0:
        return ProjectProgress(project_id=project_id, total_tasks=0,
                               completed_tasks=0, progress_pct=0.0)

    completed = sum(1 for t in tasks if t.status == "completada")
    pct = round((completed / total) * 100, 1)
    return ProjectProgress(project_id=project_id, total_tasks=total,
                           completed_tasks=completed, progress_pct=pct)


# ── CRUD Tareas ───────────────────────────────────────────────────────────────

def list_tasks(db: Session, project_id: int) -> list[ProjectTask]:
    return db.exec(
        select(ProjectTask)
        .where(ProjectTask.project_id == project_id)
        .order_by(ProjectTask.sort_order, ProjectTask.created_at)
    ).all()


def get_task(db: Session, task_id: int) -> ProjectTask | None:
    return db.get(ProjectTask, task_id)


def create_task(db: Session, project_id: int, user: User, payload: TaskCreate) -> ProjectTask:
    task = ProjectTask(
        project_id=project_id,
        created_by=user.id,
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
            task_id=task.id,
            text=item.text,
            sort_order=item.sort_order if item.sort_order else i,
        )
        db.add(ci)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task: ProjectTask, payload: TaskUpdate) -> ProjectTask:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(task, k, v)

    # Si se marca como completada, registrar timestamp y quién
    # (quién se pasa desde la route — ver route para el patrón)
    task.updated_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def complete_task(db: Session, task: ProjectTask, user: User) -> ProjectTask:
    """Marca una tarea como completada."""
    task.status = "completada"
    task.completed_at = datetime.now(timezone.utc)
    task.completed_by = user.id
    task.updated_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def reopen_task(db: Session, task: ProjectTask) -> ProjectTask:
    """Reabre una tarea completada → pendiente."""
    task.status = "pendiente"
    task.completed_at = None
    task.completed_by = None
    task.updated_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task: ProjectTask) -> None:
    # Eliminar checklist items primero
    items = db.exec(
        select(TaskChecklist).where(TaskChecklist.task_id == task.id)
    ).all()
    for item in items:
        db.delete(item)
    db.delete(task)
    db.commit()


# ── CRUD Checklist ────────────────────────────────────────────────────────────

def add_checklist_item(db: Session, task_id: int, payload: ChecklistItemCreate) -> TaskChecklist:
    item = TaskChecklist(task_id=task_id, text=payload.text, sort_order=payload.sort_order)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_checklist_item(db: Session, item: TaskChecklist, payload: ChecklistItemUpdate) -> TaskChecklist:
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


# ── Helpers de serialización ──────────────────────────────────────────────────

def task_to_dict(task: ProjectTask) -> dict:
    """Convierte una tarea a dict para WebSocket broadcast."""
    items = task.checklist_items or []
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
```

### 3.2 — Service de asignación por área

**Archivo a modificar:** `backend/app/services/project_service.py`

Agregar al final del archivo:

```python
def assign_area(
    db: Session,
    project: Project,
    area_id: int,
    assigned_by: User,
) -> Project:
    """Asigna el proyecto a un área funcional."""
    from datetime import datetime, timezone
    project.assigned_area_id = area_id
    project.assigned_area_at = datetime.now(timezone.utc)
    project.assigned_area_by = assigned_by.id
    project.updated_at = datetime.now(timezone.utc)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_area_member_emails(db: Session, area_id: int) -> list[str]:
    """Retorna emails de todos los usuarios activos en un área."""
    from sqlmodel import select
    from app.models.user import User
    users = db.exec(
        select(User).where(
            User.work_area_id == area_id,
            User.is_active == True,
        )
    ).all()
    return [u.email for u in users if u.email]
```

---

## FASE 4 — Backend: Routes

### 4.1 — Route de tareas

**Archivo nuevo:** `backend/app/routes/tasks.py`

```python
# backend/app/routes/tasks.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.core.dependencies import get_db, get_current_user
from app.core.ws_manager import ws_manager
from app.models.user import User
from app.models.project import Project
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskRead, ChecklistItemCreate,
    ChecklistItemUpdate, ChecklistItemRead, ProjectProgress,
)
from app.services import task_service as svc

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
            detail="No tienes permiso para modificar tareas de este proyecto."
        )


def _broadcast_progress(project_id: int, db: Session):
    """Calcula y broadcastea el progreso actual del proyecto."""
    import asyncio
    progress = svc.calculate_progress(db, project_id)
    asyncio.create_task(
        ws_manager.broadcast("project.progress_updated", {
            "project_id": project_id,
            "total_tasks": progress.total_tasks,
            "completed_tasks": progress.completed_tasks,
            "progress_pct": progress.progress_pct,
        })
    )


# ── Tareas CRUD ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[TaskRead])
def list_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_project_or_404(project_id, db)
    tasks = svc.list_tasks(db, project_id)
    result = []
    for t in tasks:
        items = t.checklist_items or []
        result.append(TaskRead(
            **t.model_dump(),
            checklist_items=[ChecklistItemRead.model_validate(i) for i in items],
            checklist_total=len(items),
            checklist_done=sum(1 for i in items if i.is_done),
        ))
    return result


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
    items = task.checklist_items or []

    await ws_manager.broadcast("task.created", svc.task_to_dict(task))
    _broadcast_progress(project_id, db)

    return TaskRead(
        **task.model_dump(),
        checklist_items=[ChecklistItemRead.model_validate(i) for i in items],
        checklist_total=len(items),
        checklist_done=sum(1 for i in items if i.is_done),
    )


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

    task = svc.update_task(db, task, payload)
    items = task.checklist_items or []

    await ws_manager.broadcast("task.updated", svc.task_to_dict(task))
    _broadcast_progress(project_id, db)

    return TaskRead(
        **task.model_dump(),
        checklist_items=[ChecklistItemRead.model_validate(i) for i in items],
        checklist_total=len(items),
        checklist_done=sum(1 for i in items if i.is_done),
    )


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
    items = task.checklist_items or []

    await ws_manager.broadcast("task.updated", svc.task_to_dict(task))
    _broadcast_progress(project_id, db)

    return TaskRead(
        **task.model_dump(),
        checklist_items=[ChecklistItemRead.model_validate(i) for i in items],
        checklist_total=len(items),
        checklist_done=sum(1 for i in items if i.is_done),
    )


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
    items = task.checklist_items or []

    await ws_manager.broadcast("task.updated", svc.task_to_dict(task))
    _broadcast_progress(project_id, db)

    return TaskRead(
        **task.model_dump(),
        checklist_items=[ChecklistItemRead.model_validate(i) for i in items],
        checklist_total=len(items),
        checklist_done=sum(1 for i in items if i.is_done),
    )


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
    await ws_manager.broadcast("task.deleted", {"id": task_id, "project_id": project_id})
    _broadcast_progress(project_id, db)


# ── Checklist ─────────────────────────────────────────────────────────────────

@router.post("/{task_id}/checklist", response_model=ChecklistItemRead, status_code=201)
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
    await ws_manager.broadcast("checklist.updated", {"task_id": task_id, "project_id": project_id})
    return item


@router.patch("/{task_id}/checklist/{item_id}", response_model=ChecklistItemRead)
async def update_checklist(
    project_id: int,
    task_id: int,
    item_id: int,
    payload: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlmodel import select
    from app.models.task import TaskChecklist

    project = _get_project_or_404(project_id, db)
    _require_can_modify(project, current_user, db)

    item = db.get(TaskChecklist, item_id)
    if not item or item.task_id != task_id:
        raise HTTPException(status_code=404, detail="Ítem no encontrado.")

    item = svc.update_checklist_item(db, item, payload)
    await ws_manager.broadcast("checklist.updated", {"task_id": task_id, "project_id": project_id})
    return item


@router.delete("/{task_id}/checklist/{item_id}", status_code=204)
async def delete_checklist(
    project_id: int,
    task_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.task import TaskChecklist

    project = _get_project_or_404(project_id, db)
    _require_can_modify(project, current_user, db)

    item = db.get(TaskChecklist, item_id)
    if not item or item.task_id != task_id:
        raise HTTPException(status_code=404, detail="Ítem no encontrado.")

    svc.delete_checklist_item(db, item)
    await ws_manager.broadcast("checklist.updated", {"task_id": task_id, "project_id": project_id})
```

### 4.2 — Endpoint de asignación por área

**Archivo a modificar:** `backend/app/routes/projects.py`

Agregar endpoints al final del archivo:

```python
@router.post("/{project_id}/assign-area", response_model=ProjectRead)
async def assign_area(
    project_id: int,
    payload: AssignAreaInput,   # importar desde schemas.project
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Asigna el proyecto a un área.
    - usuario (owner): solo puede asignar a su propio work_area_id
    - superadmin: puede asignar a cualquier área
    """
    from app.models.work_catalog import WorkArea
    from app.services.project_service import assign_area as svc_assign_area, get_area_member_emails
    from app.services.email_service import send_email
    import asyncio

    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")

    # Validar permisos
    is_owner = project.owner_id == current_user.id
    is_superadmin = current_user.role == "superadmin"

    if not is_owner and not is_superadmin:
        raise HTTPException(status_code=403, detail="Sin permiso.")

    if is_owner and not is_superadmin:
        # El owner solo puede asignar a su propio área
        if current_user.work_area_id != payload.area_id:
            raise HTTPException(
                status_code=403,
                detail="Solo puedes asignar el proyecto a tu propia área."
            )

    # Verificar que el área existe
    area = db.get(WorkArea, payload.area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")

    project = svc_assign_area(db, project, payload.area_id, current_user)

    # Comentario de estado
    sc = create_status_comment(
        db, project_id, current_user,
        f"Proyecto asignado al área '{area.name}' por {current_user.full_name or current_user.email}."
    )
    await ws_manager.broadcast("comment.created", {
        "id": sc.id, "project_id": sc.project_id, "author_id": sc.author_id,
        "author_role": sc.author_role, "author_name": sc.author_name,
        "message": sc.message, "tipo": sc.tipo, "created_at": sc.created_at.isoformat(),
    })
    await ws_manager.broadcast("project.area_assigned", {
        "project_id": project_id,
        "area_id": payload.area_id,
        "area_name": area.name,
    })

    # Notificar a miembros del área (fire and forget)
    area_emails = get_area_member_emails(db, payload.area_id)
    if area_emails:
        async def _notify():
            from app.models.smtp_config import SMTPConfig
            from sqlmodel import select
            config = db.exec(select(SMTPConfig)).first()
            if not config:
                return
            subject = f"📂 Proyecto asignado a tu área: {project.title}"
            body = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #E31E24;">Proyecto asignado a {area.name}</h2>
                <p>El proyecto <strong>"{project.title}"</strong> fue asignado
                a tu área por <strong>{current_user.full_name or current_user.email}</strong>.</p>
                <hr style="border-color: #eee;" />
                <p style="color: #999; font-size: 12px;">Notificación automática — Matriz ZYMO</p>
            </div>
            """
            import asyncio as _asyncio
            tasks = [send_email(db, email, subject, body) for email in area_emails]
            await _asyncio.gather(*tasks, return_exceptions=True)

        asyncio.create_task(_notify())

    return _read_with_evidence_count(db, project)
```

> IMPORTANTE: Importar `AssignAreaInput` desde `app.schemas.project` al inicio del archivo.

### 4.3 — Registrar route de tareas en `main.py`

**Archivo a modificar:** `backend/app/main.py`

Agregar:
```python
from app.routes.tasks import router as tasks_router
app.include_router(tasks_router)
```

---

## FASE 5 — Frontend: Types y Hooks

### 5.1 — Types de tareas

**Archivo nuevo:** `frontend/src/types/task.ts`

```typescript
export type TaskPriority = "urgente" | "alta" | "media" | "baja"
export type TaskStatus = "pendiente" | "en_progreso" | "completada"

export interface ChecklistItem {
  id: number
  task_id: number
  text: string
  is_done: boolean
  sort_order: number
}

export interface ProjectTask {
  id: number
  project_id: number
  created_by: number
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  due_date: string | null   // ISO date "YYYY-MM-DD"
  sort_order: number
  evidence_hint: string
  completed_at: string | null
  completed_by: number | null
  created_at: string
  updated_at: string
  checklist_items: ChecklistItem[]
  checklist_total: number
  checklist_done: number
}

export interface ProjectProgress {
  project_id: number
  total_tasks: number
  completed_tasks: number
  progress_pct: number
}

export interface TaskCreate {
  title: string
  description?: string
  priority?: TaskPriority
  due_date?: string
  sort_order?: number
  checklist_items?: { text: string; sort_order?: number }[]
}

export interface TaskUpdate {
  title?: string
  description?: string
  priority?: TaskPriority
  due_date?: string
  status?: TaskStatus
  sort_order?: number
}
```

Actualizar `frontend/src/types/project.ts` — agregar campos:
```typescript
assigned_area_id: number | null
assigned_area_at: string | null
assigned_area_by: number | null
assigned_area_name: string | null
```

### 5.2 — Hook de tareas

**Archivo nuevo:** `frontend/src/hooks/useTasks.ts`

Implementar con TanStack Query:
- `useTasks(projectId)` — GET `/projects/{id}/tasks`
- `useProjectProgress(projectId)` — GET `/projects/{id}/tasks/progress`
- `useCreateTask(projectId)` — POST — invalida `["tasks", projectId]`
- `useUpdateTask(projectId)` — PATCH `/{taskId}` — invalida `["tasks", projectId]`
- `useCompleteTask(projectId)` — POST `/{taskId}/complete` — invalida
- `useReopenTask(projectId)` — POST `/{taskId}/reopen` — invalida
- `useDeleteTask(projectId)` — DELETE — invalida
- `useAddChecklist(projectId, taskId)` — POST checklist item
- `useUpdateChecklist(projectId, taskId)` — PATCH checklist item
- `useDeleteChecklist(projectId, taskId)` — DELETE checklist item

Todas las mutaciones invalidan `["tasks", projectId]` y `["progress", projectId]`.

### 5.3 — Hook de asignación por área

**Archivo a modificar:** `frontend/src/hooks/useProjectActions.ts`

Agregar:
```typescript
// Asignar a área
const assignArea = useMutation({
  mutationFn: ({ projectId, areaId }: { projectId: number; areaId: number }) =>
    api.post(`/projects/${projectId}/assign-area`, { area_id: areaId }),
  onSuccess: (_, { projectId }) => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    queryClient.invalidateQueries({ queryKey: ["projects"] })
  },
})
```

### 5.4 — WebSocket: escuchar eventos de tareas y progreso

**Archivo a modificar:** El hook o contexto donde se manejan los eventos WebSocket del proyecto (probablemente `useProjectWebSocket` o dentro de `ProjectDetailShowcasePage`).

Agregar handlers para:
```typescript
case "task.created":
case "task.updated":
case "task.deleted":
  queryClient.invalidateQueries({ queryKey: ["tasks", projectId] })
  break

case "checklist.updated":
  queryClient.invalidateQueries({ queryKey: ["tasks", projectId] })
  break

case "project.progress_updated":
  // Actualizar el progreso directamente sin refetch si es posible
  queryClient.setQueryData(["progress", payload.project_id], payload)
  break

case "project.area_assigned":
  queryClient.invalidateQueries({ queryKey: ["project", projectId] })
  break
```

---

## FASE 6 — Frontend: Componentes

### 6.1 — Componente: `OKRProgressBar`

**Archivo nuevo:** `frontend/src/components/tasks/OKRProgressBar.tsx`

```
Funcionalidad:
- Recibe `progress: ProjectProgress` como prop (o lo carga con useProjectProgress)
- Barra visual con animación de fill (transition CSS)
- Colores según porcentaje:
    0–33%    → rojo (#E31E24, el accent del sistema)
    34–66%   → amarillo/amber
    67–99%   → azul
    100%     → verde
- Texto: "X de Y tareas completadas · Z%"
- Si no hay tareas: muestra "Sin tareas registradas aún"
- Se actualiza en tiempo real via WebSocket sin necesidad de refetch manual
```

### 6.2 — Componente: `TaskCard`

**Archivo nuevo:** `frontend/src/components/tasks/TaskCard.tsx`

```
Funcionalidad (inspirado en Microsoft Planner):
- Muestra: título, prioridad (badge de color), fecha límite, estado
- Checklist interno expandible: cada ítem con checkbox
    - Marcar ítem → llama useUpdateChecklist con is_done: true/false
    - Barra mini de progreso del checklist (X/Y ítems)
- Botón "Completar tarea" (si status != completada y el usuario tiene permiso)
- Botón "Reabrir" (si status == completada y el usuario tiene permiso)
- Botón "Eliminar" (solo si el usuario tiene permiso)
- Hint de evidencia: texto informativo en gris al pie de la card
    (usar el campo evidence_hint del modelo — "Al completar, adjunta evidencia...")
- Badge de prioridad:
    urgente → rojo
    alta    → naranja
    media   → azul
    baja    → gris
- Si due_date está vencida y tarea no completada → fecha en rojo
```

### 6.3 — Componente: `TaskCreateForm`

**Archivo nuevo:** `frontend/src/components/tasks/TaskCreateForm.tsx`

```
Funcionalidad:
- Formulario inline o modal (elige el que mejor se integre con el diseño actual)
- Campos: Título (requerido), Descripción (textarea), Prioridad (select),
  Fecha límite (date picker)
- Sección "Subtareas": lista de inputs donde se pueden agregar ítems de checklist
  antes de crear la tarea. Botón "+" para agregar ítem, "×" para quitar.
- Botón "Crear tarea"
- Solo visible para usuarios con permiso (owner o equipo dev si assigned_to_dev)
```

### 6.4 — Componente: `ProjectTasksPanel`

**Archivo nuevo:** `frontend/src/components/tasks/ProjectTasksPanel.tsx`

```
Funcionalidad (panel principal que orquesta todo):
- Carga tareas con useTasks(projectId)
- Header: "Tareas del Proyecto" + OKRProgressBar
- Botón "Nueva tarea" (solo si tiene permiso)
- Lista de TaskCard ordenadas por sort_order
- Filtros rápidos (opcional, agregar si el tiempo lo permite):
    Todos | Pendientes | En progreso | Completadas
- Estado vacío: ilustración/texto cuando no hay tareas
- Separador visual entre tareas pendientes y completadas
```

### 6.5 — Integrar `ProjectTasksPanel` en el detalle del proyecto

**Archivo a modificar:** `frontend/src/pages/ProjectDetailShowcasePage.tsx`

Agregar `<ProjectTasksPanel projectId={project.id} />` como una nueva sección/tab después de la sección de evidencias o comentarios. La posición exacta la decides basado en el layout actual.

### 6.6 — Selector de área en detalle del proyecto

**Archivo a modificar:** `frontend/src/pages/ProjectDetailShowcasePage.tsx`

Agregar sección de asignación de área:

```
Lógica de renderizado:
- Si project.assigned_area_name existe → mostrar badge con el nombre del área
- Para el OWNER (y no es superadmin):
    Si su work_area_id está definido → mostrar botón "Asignar a mi área"
    Si ya está asignada a su área → no mostrar botón (ya asignado)
- Para SUPERADMIN:
    Mostrar select con todas las áreas del catálogo (GET /catalog/areas)
    Botón "Asignar a área seleccionada"
    Puede reasignar aunque ya tenga área asignada
- El badge del área y el del "Área de Desarrollo" (assigned_to_dev) son independientes
  y pueden coexistir visualmente
```

---

## FASE 7 — Verificación final

### Checklist que Cursor debe ejecutar antes de marcar como completo:

**Backend:**
- [ ] Arrancar uvicorn sin errores — las tablas `projecttask` y `taskchecklist` existen en BD
- [ ] Las columnas `assigned_area_id`, `assigned_area_at`, `assigned_area_by` existen en tabla `project`
- [ ] `GET /projects/{id}/tasks` retorna lista vacía (no error) si no hay tareas
- [ ] `GET /projects/{id}/tasks/progress` retorna `{progress_pct: 0.0, total_tasks: 0}` si no hay tareas
- [ ] `POST /projects/{id}/tasks` falla con 403 si el usuario no es owner ni equipo dev
- [ ] `POST /projects/{id}/assign-area` — owner no puede asignar a área diferente a la suya (debe retornar 403)
- [ ] Completar una tarea broadcastea `task.updated` Y `project.progress_updated` por WebSocket
- [ ] El email de asignación de área no bloquea la respuesta HTTP (fire and forget)

**Frontend:**
- [ ] `pnpm build` sin errores TypeScript
- [ ] La barra `OKRProgressBar` se actualiza en tiempo real al completar una tarea desde otra ventana
- [ ] El selector de área para owner no muestra áreas distintas a la suya
- [ ] El selector de área para superadmin muestra todas las áreas del catálogo
- [ ] `TaskCard` con due_date vencida muestra la fecha en rojo
- [ ] El hint de evidencia aparece en cada task card
- [ ] Los badges de área y de "Área de Desarrollo" coexisten correctamente

---

## NOTAS FINALES PARA EL AGENTE

1. **El progreso SIEMPRE se calcula en el backend** (`task_service.calculate_progress`). El frontend nunca calcula el porcentaje — solo lo muestra.

2. **`asyncio.create_task()` es intencional** en todos los broadcasts y emails dentro de endpoints `async def`. No lo cambies a `await` en los emails.

3. **Las tablas nuevas** (`projecttask`, `taskchecklist`) las crea `create_all()` automáticamente — no agregues entradas en `run_migrations()` para ellas.

4. **Las columnas nuevas en `project`** (`assigned_area_*`) SÍ van en `run_migrations()` — ya están incluidas en la Fase 1.4.

5. **Orden de ejecución:** Fase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7. No saltes fases.

6. **Lee `rules.md` completo antes de empezar.**
