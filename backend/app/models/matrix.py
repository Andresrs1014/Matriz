from datetime import datetime, timezone
from typing import Optional

from sqlmodel import SQLModel, Field


class MatrixQuestion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    key: str = Field(index=True, nullable=False, sa_column_kwargs={"unique": True}, max_length=120)
    axis: str = Field(nullable=False, max_length=20)  # impact | effort
    text: str = Field(nullable=False, max_length=1000)

    weight: float = Field(default=1.0, nullable=False)
    order: int = Field(default=0, nullable=False)
    is_active: bool = Field(default=True, nullable=False)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)


class MatrixEvaluation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    project_id: int = Field(foreign_key="project.id", index=True, nullable=False)
    evaluator_user_id: int | None = Field(default=None, foreign_key="user.id", index=True)

    impact_score: float = Field(default=0.0, nullable=False)   # 0-100
    effort_score: float = Field(default=0.0, nullable=False)   # 0-100
    quadrant: str = Field(default="sin_calcular", nullable=False, max_length=50)

    notes: str | None = Field(default=None, max_length=2000)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)


class EvaluationResponse(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    evaluation_id: int = Field(foreign_key="matrixevaluation.id", index=True, nullable=False)
    question_id: int = Field(foreign_key="matrixquestion.id", index=True, nullable=False)

    value: int = Field(nullable=False)  # 1-5
