from datetime import datetime
from pydantic import BaseModel

class CommentCreate(BaseModel):
    message: str
    tipo:    str = "comentario"   # comentario | feedback | aprobacion

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
