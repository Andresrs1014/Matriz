from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CommentCreate(BaseModel):
    message: str
    tipo: Literal[
        "comentario",
        "cambio_estado",
        "feedback",
        "aprobacion",
        "actualizacion",
        "extension_fecha",
    ] = "comentario"

class CommentRead(BaseModel):
    id:          int
    project_id:  int
    author_id:   int
    author_role: str
    author_name: str
    message:     str
    tipo:        str
    created_at:  datetime

    model_config = {"from_attributes": True}
