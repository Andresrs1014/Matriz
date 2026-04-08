# backend/app/models/draft.py
from datetime import datetime, timezone
from typing import ClassVar, Optional
from sqlmodel import SQLModel, Field


class ProjectDraft(SQLModel, table=True):
    __tablename__: ClassVar[str] = "project_draft"

    id: Optional[int] = Field(default=None, primary_key=True)
    owner_id: int = Field(index=True, foreign_key="user.id", nullable=False, unique=True)

    title: Optional[str] = Field(default=None, nullable=True)
    okr_objectives: Optional[str] = Field(default=None, nullable=True)
    key_results: Optional[str] = Field(default=None, nullable=True)
    key_actions: Optional[str] = Field(default=None, nullable=True)
    resources: Optional[str] = Field(default=None, nullable=True)
    five_whys: Optional[str] = Field(default=None, nullable=True)
    measurement_methods: Optional[str] = Field(default=None, nullable=True)
    okr_creator: Optional[str] = Field(default=None, nullable=True)
    collaborators_json: Optional[str] = Field(default=None, nullable=True)

    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
