from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional

class ProjectCreate(BaseModel):
    title: str
    description: str | None = None
    okr_objectives: str | None = None
    key_results: str | None = None
    key_actions: str | None = None
    resources: str | None = None
    five_whys: str | None = None
    measurement_methods: str | None = None
    collaborators: list[str] = Field(default_factory=list)

class ProjectRead(BaseModel):
    id: int
    title: str
    description: str | None
    okr_objectives: str | None
    key_results: str | None
    key_actions: str | None
    resources: str | None
    five_whys: str | None
    measurement_methods: str | None
    submitted_by_name: str | None = None
    collaborators: list[str] = Field(default_factory=list)
    status: str
    source: str
    owner_id: int
    ms_list_id: str | None
    approved_by: int | None = None
    approved_at: datetime | None = None
    final_approved_by: int | None = None
    final_approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class AprobacionFinalInput(BaseModel):
    salario_base: float
    cargo: str
    num_personas: int = 1
    sede: str | None = None
    observacion: str | None = None

class CustomQuestionInput(BaseModel):
    text: str
    axis: str = "impact"  # "impact" | "effort"

class SuperaprobacionInput(BaseModel):
    question_ids: list[int] = []
    custom_questions: list[CustomQuestionInput] = []  # ← objetos con axis, no strings

class SalarioInput(BaseModel):
    salario_base: float
    cargo: str
    sede: str | None = None

class DatosOperacionalesInput(BaseModel):
    num_personas: int
    horas_proceso_actual: float
    horas_proceso_nuevo: float
    observacion: str | None = None

class ProjectQuestionRead(BaseModel):
    id: int
    project_id: int
    question_text: str
    axis: str = "impact"           # ← AÑADIDO: "impact" | "effort"
    source_question_id: int | None = None   # ← eliminado el duplicado
    created_by: int
    created_at: datetime
    model_config = {"from_attributes": True}
