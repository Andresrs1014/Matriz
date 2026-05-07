# backend/app/models/task.py
"""Tareas y checklist: solo columnas y FKs, sin Relationship (compat. SQLAlchemy 2 + SQLModel)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class ProjectTask(SQLModel, table=True):
    """Tarea asociada a un proyecto OKR."""

    __tablename__ = "projecttask"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", nullable=False, index=True)
    created_by: int = Field(foreign_key="user.id", nullable=False)

    title: str = Field(max_length=300, nullable=False)
    description: Optional[str] = Field(default=None)

    priority: str = Field(default="media", max_length=20, nullable=False)
    status: str = Field(default="pendiente", max_length=30, nullable=False)

    due_date: Optional[date] = Field(default=None)
    sort_order: int = Field(default=0, nullable=False)

    evidence_hint: str = Field(
        default="Al completar esta tarea, adjunta evidencia en el panel de evidencias del proyecto (opcional).",
        max_length=500,
        nullable=False,
    )

    completed_at: Optional[datetime] = Field(default=None)
    completed_by: Optional[int] = Field(default=None, foreign_key="user.id")

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )


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
