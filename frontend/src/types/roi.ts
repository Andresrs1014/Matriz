export interface ROIInput {
  horas_inversion:        number
  valor_hora:             number
  costo_infraestructura:  number
  horas_ahorradas_semana: number
  semanas_anio:           number
  ahorro_directo:         number
  ahorro_errores:         number
}

export interface ROIRead {
  id:         number
  project_id: number

  // inputs
  horas_inversion:        number
  valor_hora:             number
  costo_infraestructura:  number
  horas_ahorradas_semana: number
  semanas_anio:           number
  ahorro_directo:         number
  ahorro_errores:         number

  // outputs calculados
  costo_total:          number
  ahorro_anual:         number
  horas_liberadas_anio: number
  roi_pct:              number
  payback_semanas:      number
  cuadrante_roi:        ROICuadranteKey

  created_at: string
}

export interface ROIPlotPoint {
  project_id:      number
  project_title:   string
  roi_pct:         number
  payback_semanas: number
  cuadrante_roi:   ROICuadranteKey
  roi_id:          number
  evaluated_at:    string
}

export type ROICuadranteKey =
  | "rentable_rapido"
  | "rentable_lento"
  | "dudoso_rapido"
  | "no_justificado"

export const ROI_QUADRANT_CONFIG: Record<ROICuadranteKey, {
  label:       string
  action:      string
  textClass:   string
  bgClass:     string
  borderClass: string
  color:       string
}> = {
  rentable_rapido: {
    label:       "Rentable Rápido",
    action:      "Ejecutar ya",
    textClass:   "text-emerald-400",
    bgClass:     "bg-emerald-500/10",
    borderClass: "border-emerald-500/30",
    color:       "#10b981",
  },
  rentable_lento: {
    label:       "Rentable Lento",
    action:      "Planificar",
    textClass:   "text-blue-400",
    bgClass:     "bg-blue-500/10",
    borderClass: "border-blue-500/30",
    color:       "#60a5fa",
  },
  dudoso_rapido: {
    label:       "Dudoso Rápido",
    action:      "Evaluar",
    textClass:   "text-amber-400",
    bgClass:     "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    color:       "#f59e0b",
  },
  no_justificado: {
    label:       "No justificado",
    action:      "Descartar",
    textClass:   "text-rose-400",
    bgClass:     "bg-rose-500/10",
    borderClass: "border-rose-500/30",
    color:       "#f43f5e",
  },
}
