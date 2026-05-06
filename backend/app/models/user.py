from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, nullable=False, sa_column_kwargs={"unique": True})
    full_name: str | None = Field(default=None, max_length=200)
    hashed_password: str = Field(nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    role: str = Field(default="usuario", nullable=False, max_length=50)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    deactivated_at: datetime | None = Field(default=None)

    work_area_id: Optional[int] = Field(default=None, foreign_key="workarea.id")
    work_site_id: Optional[int] = Field(default=None, foreign_key="worksite.id")
