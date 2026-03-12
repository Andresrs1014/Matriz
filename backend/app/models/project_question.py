# backend/app/models/project_question.py
from datetime import datetime, timezone
from typing import ClassVar, Optional
from sqlmodel import SQLModel, Field


class ProjectQuestion(SQLModel, table=True):
    __tablename__: ClassVar[str] = "project_questions"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    question_text: str
    source_question_id: Optional[int] = Field(default=None)
    created_by: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
