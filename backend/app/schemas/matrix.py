# backend/app/schemas/matrix.py
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

# ── Categorías (Paquetes) ─────────────────────────────────────────────────────
class CategoryCreate(BaseModel):
    name: str
    description: str | None = None
    is_default: bool = False

class CategoryRead(BaseModel):
    id: int
    name: str
    description: str | None
    is_default: bool
    is_active: bool
    model_config = {"from_attributes": True}

# ── Preguntas ─────────────────────────────────────────────────────────────────
class QuestionRead(BaseModel):
    id: int
    text: str
    axis: str
    weight: float
    order: int
    category_id: int
    is_active: bool
    model_config = {"from_attributes": True}

class QuestionBulkItem(BaseModel):
    text: str
    axis: str  # "impact" | "effort"
    weight: float = 1.0
    order: int = 0

class CategoryWithQuestionsCreate(BaseModel):
    name: str
    description: str | None = None
    is_default: bool = False
    questions: list[QuestionBulkItem]

class CategoryWithQuestionsRead(BaseModel):
    id: int
    name: str
    description: str | None
    is_default: bool
    is_active: bool
    questions: list[QuestionRead]
    model_config = {"from_attributes": True}

# ── Evaluaciones ──────────────────────────────────────────────────────────────
class ResponseItem(BaseModel):
    question_id: int | None = None                   # MatrixQuestion (catálogo)
    project_question_id: int | None = None           # ← NUEVO: ProjectQuestion (custom)
    value: int  # 1–5

class EvaluationSubmit(BaseModel):
    responses: list[ResponseItem]
    category_id: int | None = None
    notes: str | None = None

class EvaluationRead(BaseModel):
    id: int
    project_id: int
    category_id: int | None
    impact_score: float
    effort_score: float
    quadrant: str
    notes: str | None
    created_at: datetime
    model_config = {"from_attributes": True}

# ── Plots ─────────────────────────────────────────────────────────────────────
class MatrixPlotPoint(BaseModel):
    project_id: int
    project_title: str
    impact_score: float
    effort_score: float
    quadrant: str
    evaluation_id: int
    evaluated_at: datetime
    model_config = {"from_attributes": True}

class QuadrantSummary(BaseModel):
    quadrant: str
    label: str
    count: int
    projects: list[str]
