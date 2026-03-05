from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field


class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    title: str = Field(nullable=False, max_length=200)
    description: str | None = Field(default=None, max_length=2000)

    status: str = Field(default="nuevo", nullable=False, max_length=50)

    owner_id: int = Field(index=True, nullable=False, foreign_key="user.id")

    source: str = Field(default="manual", nullable=False, max_length=50)  # manual | list
    ms_list_id: str | None = Field(default=None, index=True, max_length=100)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
