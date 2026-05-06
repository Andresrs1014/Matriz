from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field

class ProjectComment(SQLModel, table=True):
    __tablename__: str = "projectcomment"

    id:         Optional[int] = Field(default=None, primary_key=True)
    project_id: int           = Field(index=True, nullable=False, foreign_key="project.id")
    author_id:  int           = Field(nullable=False, foreign_key="user.id")

    # Rol del autor al momento de escribir (se guarda para no perderlo si cambia)
    author_role: str          = Field(nullable=False, max_length=50)
    author_name: str          = Field(nullable=False, max_length=200)

    message:    str           = Field(nullable=False, max_length=2000)

    # Tipo: comentario | cambio_estado | feedback | aprobacion
    tipo:       str           = Field(default="comentario", nullable=False, max_length=50)

    created_at: datetime      = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
