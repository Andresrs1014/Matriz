from datetime import datetime
from pydantic import BaseModel, Field

SEDES = ["IMCCARGO", "LOGIMAT", "IMCDEPOSITO"]


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

    # Parte 1
    cargo: str
    sede: str
    num_personas: int
    valor_quincena: float
    valor_dia: float
    valor_hora_hombre: float
    # salario_base NO se expone

    # Parte 2
    horas_proceso_actual: float
    horas_proyectadas: float

    # Calculados
    horas_ahorradas: float
    roi_valor: float         # ahorro por 1 persona
    roi_valor_total: float   # ahorro total × num_personas
    roi_pct: float
    cuadrante_roi: str
    created_at: datetime

    model_config = {"from_attributes": True}


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
