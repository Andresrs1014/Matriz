from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field

# Estados del flujo:
# pendiente_revision → aprobado → en_evaluacion → evaluado → aprobado_final
class Project(SQLModel, table=True):
    id:           Optional[int] = Field(default=None, primary_key=True)
    title:        str           = Field(nullable=False, max_length=200)
    description:  str | None   = Field(default=None, max_length=2000)

    # Estado del flujo de aprobación
    status: str = Field(default="pendiente_revision", nullable=False, max_length=50)

    # Quién lo creó
    owner_id: int = Field(index=True, nullable=False, foreign_key="user.id")

    # Quién lo aprobó (admin que da visto bueno)
    approved_by: int | None = Field(default=None, foreign_key="user.id")
    approved_at: datetime | None = Field(default=None)

    # Quién lo aprobó en aprobación final
    final_approved_by: int | None = Field(default=None, foreign_key="user.id")
    final_approved_at: datetime | None = Field(default=None)

    source:      str       = Field(default="manual", nullable=False, max_length=50)  # manual | list
    ms_list_id:  str | None = Field(default=None, index=True, max_length=100)

    created_at:  datetime  = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at:  datetime  = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
