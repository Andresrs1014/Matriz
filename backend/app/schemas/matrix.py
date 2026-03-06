from datetime import datetime
from pydantic import BaseModel, Field


# ── Request ──────────────────────────────────────────────────────────────────

class EvaluationResponseInput(BaseModel):
    question_id: int
    value: int = Field(ge=1, le=5, description="Escala 1 (mínimo) a 5 (máximo)")


class EvaluationSubmit(BaseModel):
    responses: list[EvaluationResponseInput] = Field(
        min_length=2,
        description="Respuestas a las preguntas de la categoría seleccionada"
    )
    category_id: int | None = Field(default=None)
    notes: str | None = Field(default=None, max_length=2000)


# ── Response ─────────────────────────────────────────────────────────────────

class CategoryRead(BaseModel):
    id: int
    name: str
    description: str | None
    is_default: bool


class QuestionRead(BaseModel):
    id: int
    category_id: int | None
    axis: str
    text: str
    weight: float
    order: int


class EvaluationRead(BaseModel):
    id: int
    project_id: int
    category_id: int | None
    impact_score: float
    effort_score: float
    quadrant: str
    notes: str | None
    created_at: datetime


class MatrixPlotPoint(BaseModel):
    project_id: int
    project_title: str
    impact_score: float
    effort_score: float
    quadrant: str
    evaluation_id: int
    evaluated_at: datetime


class QuadrantSummary(BaseModel):
    quadrant: str
    label: str
    count: int
    projects: list[str]
