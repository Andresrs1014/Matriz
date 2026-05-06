from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.user import User


class WorkArea(SQLModel, table=True):
    """Catálogo de áreas (dropdown en usuarios)."""

    __table_args__ = (UniqueConstraint("name", name="uq_workarea_name"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=120, nullable=False, index=True)
    sort_order: int = Field(default=0, nullable=False)

    users: list["User"] = Relationship(back_populates="work_area")


class WorkSite(SQLModel, table=True):
    """Catálogo de sedes / 'plataforma' operativa (Logimat, IMCargo, etc.)."""

    __table_args__ = (UniqueConstraint("name", name="uq_worksite_name"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=120, nullable=False, index=True)
    sort_order: int = Field(default=0, nullable=False)

    users: list["User"] = Relationship(back_populates="work_site")
