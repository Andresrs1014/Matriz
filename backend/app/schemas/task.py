# backend/app/schemas/task.py
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Priority = Literal["urgente", "alta", "media", "baja"]
TaskStatus = Literal["pendiente", "en_progreso", "completada"]


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


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    priority: Priority = "media"
    due_date: Optional[date] = None
    sort_order: int = 0
    checklist_items: list[ChecklistItemCreate] = Field(default_factory=list)


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
    checklist_items: list[ChecklistItemRead] = Field(default_factory=list)
    checklist_total: int = 0
    checklist_done: int = 0
    model_config = {"from_attributes": True}


class ProjectProgress(BaseModel):
    project_id: int
    total_tasks: int
    completed_tasks: int
    progress_pct: float
