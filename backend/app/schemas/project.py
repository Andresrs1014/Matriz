from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class ProjectCreate(BaseModel):
    title:       str
    description: str | None = None

class ProjectRead(BaseModel):
    id:                 int
    title:              str
    description:        str | None
    status:             str
    source:             str
    owner_id:           int
    ms_list_id:         str | None
    approved_by:        int | None = None
    approved_at:        datetime | None = None
    final_approved_by:  int | None = None
    final_approved_at:  datetime | None = None
    created_at:         datetime
    updated_at:         datetime

    model_config = {"from_attributes": True}

# Encuesta que llena el admin al dar aprobación final
class AprobacionFinalInput(BaseModel):
    salario_base:  float
    cargo:         str
    num_personas:  int = 1
    sede:          str | None = None
    observacion:   str | None = None
