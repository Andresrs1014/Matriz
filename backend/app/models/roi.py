from datetime import datetime, timezone
from typing import ClassVar, Optional
from sqlmodel import SQLModel, Field


class ROIEvaluation(SQLModel, table=True):
    __tablename__: ClassVar[str] = "roievaluation"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(index=True, foreign_key="project.id", nullable=False)

    # ── Parte 1 — datos del jefe ─────────────────────────────────────────────
    cargo: str = Field(nullable=False)
    sede: str = Field(nullable=False)
    num_personas: int = Field(default=1, nullable=False)
    salario_base: float = Field(nullable=False)  # no se expone en Read

    # Calculados desde salario_base
    valor_quincena: float = Field(nullable=False)
    valor_dia: float = Field(nullable=False)
    valor_hora_hombre: float = Field(nullable=False)

    # ── Parte 2 — proyección del analista ────────────────────────────────────
    horas_proceso_actual: float = Field(default=0.0, nullable=False)
    horas_proyectadas: float = Field(default=0.0, nullable=False)

    # ── Calculados automáticamente ───────────────────────────────────────────
    horas_ahorradas: float = Field(default=0.0, nullable=False)
    roi_valor: float = Field(default=0.0, nullable=False)       # en COP
    roi_valor_total: float = Field(default=0.0, nullable=False) # roi_valor × num_personas
    roi_pct: float = Field(default=0.0, nullable=False)
    cuadrante_roi: str = Field(default="sin_evaluar", nullable=False)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
