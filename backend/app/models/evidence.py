# backend/app/models/evidence.py
from datetime import datetime, timezone
from typing import ClassVar, Optional
from sqlmodel import SQLModel, Field


class ProjectEvidence(SQLModel, table=True):
    __tablename__: ClassVar[str] = "projectevidence"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(index=True, foreign_key="project.id", nullable=False)
    uploaded_by: int = Field(foreign_key="user.id", nullable=False)
    uploader_name: str = Field(max_length=200, nullable=False)
    uploader_role: str = Field(max_length=50, nullable=False)
    filename: str = Field(max_length=255, nullable=False)
    storage_path: str = Field(max_length=500, nullable=False)
    mime_type: str = Field(max_length=120, nullable=False)
    extension: str = Field(max_length=16, nullable=False)
    size_bytes: int = Field(nullable=False)
    sha256: str = Field(max_length=64, nullable=False)
    description: Optional[str] = Field(default=None, max_length=500, nullable=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    deleted_at: Optional[datetime] = Field(default=None, nullable=True)
