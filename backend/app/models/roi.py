# backend/app/models/roi.py
from datetime import datetime, timezone
from typing import ClassVar, Optional
from sqlmodel import SQLModel, Field


class ROIEvaluation(SQLModel, table=True):
    __tablename__: ClassVar[str] = "roievaluation"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(index=True, foreign_key="project.id", nullable=False)

    # ── Parte 1 — datos del SUPERADMIN (privados) ──────────────────────────
    cargo: str = Field(nullable=False)
    sede: str = Field(default="No especificada", nullable=False)
    salario_base: float = Field(nullable=False)           # NUNCA se expone en Read

    # Calculados desde salario_base
    valor_quincena: float = Field(nullable=False)
    valor_dia: float = Field(nullable=False)
    valor_hora_hombre: float = Field(nullable=False)

    # ── Parte 2 — datos operacionales del ADMIN ────────────────────────────
    num_personas: int = Field(default=0, nullable=False)
    horas_proceso_actual: float = Field(default=0.0, nullable=False)
    horas_proceso_nuevo: float = Field(default=0.0, nullable=False)   # antes: horas_proyectadas

    # ── Calculados automáticamente al completar parte 2 ────────────────────
    horas_ahorradas: float = Field(default=0.0, nullable=False)
    ahorro_horas_hombre: float = Field(default=0.0, nullable=False)   # horas_ahorradas × num_personas
    valor_ahorro: float = Field(default=0.0, nullable=False)          # ahorro_horas_hombre × valor_hora_hombre
    roi_valor: float = Field(default=0.0, nullable=False)             # valor_ahorro por persona (alias de valor_ahorro / num_personas)
    roi_valor_total: float = Field(default=0.0, nullable=False)       # valor_ahorro total
    roi_pct: float = Field(default=0.0, nullable=False)
    cuadrante_roi: str = Field(default="sin_evaluar", nullable=False)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
