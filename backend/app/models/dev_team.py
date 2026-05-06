# backend/app/models/dev_team.py
from datetime import datetime, timezone
from typing import ClassVar, Optional

from sqlmodel import SQLModel, Field


class DevTeamMember(SQLModel, table=True):
    __tablename__: ClassVar[str] = "devteammember"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, foreign_key="user.id", nullable=False, unique=True)
    added_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
