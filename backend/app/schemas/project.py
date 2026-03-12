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


# Superadmin aprueba y asigna preguntas al mismo tiempo
class SuperaprobacionInput(BaseModel):
    question_ids: list[int] = []      # IDs de MatrixQuestion existentes
    custom_questions: list[str] = []  # textos libres de preguntas nuevas


# Superadmin provee el salario (privado, solo para calcular ROI)
class SalarioInput(BaseModel):
    salario_base: float
    cargo: str
    sede: str | None = None


# Admin llena los datos operacionales del ROI
class DatosOperacionalesInput(BaseModel):
    num_personas: int
    horas_proceso_actual: float
    horas_proceso_nuevo: float
    observacion: str | None = None


# Schema para leer una pregunta asignada al proyecto
class ProjectQuestionRead(BaseModel):
    id: int
    project_id: int
    question_text: str
    source_question_id: int | None
    created_by: int
    created_at: datetime

    model_config = {"from_attributes": True}
