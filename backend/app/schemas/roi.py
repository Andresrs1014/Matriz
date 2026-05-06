from datetime import datetime
from pydantic import BaseModel, Field, model_validator

SEDES = ["LOGIMAT", "LOGIMAT B2", "IMC CARGO", "IMC DEPOSITO"]


# ── Parte 1 — la llena el jefe ───────────────────────────────────────────────
class ROIParte1Input(BaseModel):
    cargo: str = Field(..., description="Cargo de la persona evaluada")
    sede: str = Field(..., description="Sede donde se ejecuta el proceso")
    num_personas: int = Field(..., gt=0, description="Número de personas que realizan el proceso")
    salario_base: float = Field(..., gt=0, description="Salario mensual bruto por persona (COP)")


# ── Parte 2 — la llena el analista ──────────────────────────────────────────
class ROIParte2Input(BaseModel):
    horas_proceso_actual: float = Field(..., gt=0, description="Horas que tarda el proceso HOY")
    horas_proyectadas: float = Field(..., ge=0, description="Horas proyectadas tras la automatización")


# ── Respuesta completa ────────────────────────────────────────────────────────
class ROIRead(BaseModel):
    id: int
    project_id: int
    cargo: str
    sede: str
    num_personas: int
    valor_quincena: float
    valor_dia: float
    valor_hora_hombre: float
    horas_proceso_actual: float
    horas_proceso_nuevo: float = Field(default=0.0)   # nombre real en el modelo
    horas_proyectadas: float = Field(default=0.0)     # alias para el frontend
    horas_ahorradas: float = Field(default=0.0)
    ahorro_horas_hombre: float = Field(default=0.0)
    valor_ahorro: float = Field(default=0.0)
    roi_valor: float = Field(default=0.0)
    roi_valor_total: float = Field(default=0.0)
    roi_pct: float = Field(default=0.0)
    cuadrante_roi: str = Field(default="sin_evaluar")
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def sync_horas_proyectadas(self) -> "ROIRead":
        if self.horas_proyectadas == 0.0 and self.horas_proceso_nuevo > 0:
            self.horas_proyectadas = self.horas_proceso_nuevo
        return self




# ── Para la matriz ROI ────────────────────────────────────────────────────────
class ROIPlotPoint(BaseModel):
    project_id: int
    project_title: str
    horas_proceso_actual: float
    horas_ahorradas: float
    roi_pct: float
    roi_valor_total: float
    num_personas: int
    cuadrante_roi: str
    roi_id: int
    evaluated_at: datetime
