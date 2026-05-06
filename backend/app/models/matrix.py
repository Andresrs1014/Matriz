# backend/app/models/matrix.py
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field

class QuestionCategory(SQLModel, table=True):
    """Categorías de evaluación por área (ej: Operaciones, Compras, RRHH)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, nullable=False)
    description: str | None = Field(default=None, max_length=300)
    is_active: bool = Field(default=True, nullable=False)
    is_default: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

class MatrixQuestion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int | None = Field(default=None, foreign_key="questioncategory.id")
    axis: str = Field(nullable=False, max_length=20)  # impact | effort
    text: str = Field(nullable=False, max_length=500)
    weight: float = Field(default=1.0, nullable=False)
    order: int = Field(default=0, nullable=False)
    is_active: bool = Field(default=True, nullable=False)

class MatrixEvaluation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", nullable=False)
    category_id: int | None = Field(default=None, foreign_key="questioncategory.id")
    impact_score: float = Field(nullable=False)
    effort_score: float = Field(nullable=False)
    quadrant: str = Field(nullable=False, max_length=50)
    notes: str | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

class EvaluationResponse(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    evaluation_id: int = Field(foreign_key="matrixevaluation.id", nullable=False)
    # Para preguntas del catálogo (MatrixQuestion)
    question_id: int | None = Field(
        default=None, foreign_key="matrixquestion.id", nullable=True  # ← era NOT NULL, ahora nullable
    )
    # ← NUEVO: para preguntas custom (ProjectQuestion)
    project_question_id: int | None = Field(
        default=None, foreign_key="project_questions.id", nullable=True
    )
    value: int = Field(nullable=False)
