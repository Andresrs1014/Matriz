export interface ROIParte1Input {
  cargo: string
  sede: string
  num_personas: number
  salario_base: number
}

export interface ROIParte2Input {
  horas_proceso_actual: number
  horas_proyectadas: number
}

export interface ROIRead {
  id: number
  project_id: number
  // Parte 1
  cargo: string
  sede: string
  num_personas: number
  valor_quincena: number
  valor_dia: number
  valor_hora_hombre: number
  // salario_base NO viene del backend
  // Parte 2
  horas_proceso_actual: number
  horas_proyectadas: number
  // Calculados
  horas_ahorradas: number
  roi_valor: number
  roi_valor_total: number
  roi_pct: number
  cuadrante_roi: ROICuadranteKey
  created_at: string
}

export interface ROIPlotPoint {
  project_id: number
  project_title: string
  horas_proceso_actual: number
  horas_ahorradas: number
  roi_pct: number
  roi_valor_total: number
  num_personas: number
  cuadrante_roi: ROICuadranteKey
  roi_id: number
  evaluated_at: string
}

export type ROICuadranteKey =
  | "alto_impacto"
  | "eficiencia_menor"
  | "proceso_pesado"
  | "bajo_impacto"

export const ROI_QUADRANT_CONFIG: Record<ROICuadranteKey, {
  label: string
  action: string
  textClass: string
  bgClass: string
  borderClass: string
  color: string
}> = {
  alto_impacto: {
    label: "Alto Impacto",
    action: "Ejecutar ya",
    textClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/30",
    color: "#10b981",
  },
  eficiencia_menor: {
    label: "Eficiencia Menor",
    action: "Planificar",
    textClass: "text-blue-400",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/30",
    color: "#60a5fa",
  },
  proceso_pesado: {
    label: "Proceso Pesado",
    action: "Evaluar",
    textClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    color: "#f59e0b",
  },
  bajo_impacto: {
    label: "Bajo Impacto",
    action: "Revisar",
    textClass: "text-rose-400",
    bgClass: "bg-rose-500/10",
    borderClass: "border-rose-500/30",
    color: "#f43f5e",
  },
}
