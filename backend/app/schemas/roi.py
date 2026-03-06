from datetime import datetime
from pydantic import BaseModel, Field


class ROIInput(BaseModel):
    horas_inversion:        float = Field(..., gt=0,  description="Horas dedicadas al proyecto")
    valor_hora:             float = Field(..., gt=0,  description="Costo por hora ($)")
    costo_infraestructura:  float = Field(0.0, ge=0, description="Licencias / infraestructura ($)")
    horas_ahorradas_semana: float = Field(..., gt=0,  description="Horas liberadas por semana")
    semanas_anio:           int   = Field(48,  gt=0,  description="Semanas laborales al año")
    ahorro_directo:         float = Field(0.0, ge=0, description="Ahorro anual directo ($)")
    ahorro_errores:         float = Field(0.0, ge=0, description="Ahorro por reducción de errores ($)")


class ROIRead(BaseModel):
    id:         int
    project_id: int

    # inputs
    horas_inversion:        float
    valor_hora:             float
    costo_infraestructura:  float
    horas_ahorradas_semana: float
    semanas_anio:           int
    ahorro_directo:         float
    ahorro_errores:         float

    # outputs calculados
    costo_total:          float
    ahorro_anual:         float
    horas_liberadas_anio: float
    roi_pct:              float
    payback_semanas:      float
    cuadrante_roi:        str

    created_at: datetime

    model_config = {"from_attributes": True}


class ROIPlotPoint(BaseModel):
    project_id:      int
    project_title:   str
    roi_pct:         float
    payback_semanas: float
    cuadrante_roi:   str
    roi_id:          int
    evaluated_at:    datetime
