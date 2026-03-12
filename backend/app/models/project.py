# backend/app/models/project.py
from datetime import datetime, timezone
from typing import ClassVar, Optional
from sqlmodel import SQLModel, Field


class Project(SQLModel, table=True):
    __tablename__: ClassVar[str] = "project"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(nullable=False)
    description: Optional[str] = Field(default=None, nullable=True)
    status: str = Field(default="pendiente_revision", nullable=False)
    source: str = Field(default="manual", nullable=False)
    owner_id: int = Field(index=True, foreign_key="user.id", nullable=False)
    ms_list_id: Optional[str] = Field(default=None, nullable=True)

    # Aprobación del superadmin
    approved_by: Optional[int] = Field(default=None, nullable=True)
    approved_at: Optional[datetime] = Field(default=None, nullable=True)

    # Cierre final
    final_approved_by: Optional[int] = Field(default=None, nullable=True)
    final_approved_at: Optional[datetime] = Field(default=None, nullable=True)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
