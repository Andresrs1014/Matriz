from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class ROIEvaluation(SQLModel, table=True):
    __tablename__ = "roievaluation"

    id:         Optional[int] = Field(default=None, primary_key=True)
    project_id: int           = Field(index=True, foreign_key="project.id", nullable=False)

    # ── Inputs: costos ──────────────────────────────────────────────────────────
    horas_inversion:       float = Field(nullable=False)
    valor_hora:            float = Field(nullable=False)
    costo_infraestructura: float = Field(default=0.0)

    # ── Inputs: beneficios ───────────────────────────────────────────────────────
    horas_ahorradas_semana: float = Field(nullable=False)
    semanas_anio:           int   = Field(default=48)
    ahorro_directo:         float = Field(default=0.0)
    ahorro_errores:         float = Field(default=0.0)

    # ── Outputs calculados ───────────────────────────────────────────────────────
    costo_total:          float = Field(nullable=False)
    ahorro_anual:         float = Field(nullable=False)
    horas_liberadas_anio: float = Field(nullable=False)
    roi_pct:              float = Field(nullable=False)
    payback_semanas:      float = Field(nullable=False)
    cuadrante_roi:        str   = Field(nullable=False, max_length=30)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
