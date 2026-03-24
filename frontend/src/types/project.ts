// frontend/src/types/project.ts
export interface Project {
  id: number
  title: string
  description: string | null
  okr_objectives: string | null
  key_results: string | null
  key_actions: string | null
  resources: string | null
  five_whys: string | null
  measurement_methods: string | null
  submitted_by_name: string | null
  collaborators: string[]
  status: string
  source: string
  owner_id: number
  ms_list_id: string | null
  approved_by: number | null
  approved_at: string | null
  final_approved_by: number | null
  final_approved_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectCreate {
  title: string
  description?: string
  okr_objectives?: string
  key_results?: string
  key_actions?: string
  resources?: string
  five_whys?: string
  measurement_methods?: string
  collaborators?: string[]
}

export interface ProjectQuestion {
  id: number
  project_id: number
  question_text: string
  axis: "impact" | "effort"   
  source_question_id: number | null
  created_by: number
  created_at: string
}

// Payload para que el superadmin apruebe y asigne preguntas
export interface SuperaprobacionPayload {
  question_ids: number[]
  custom_questions: string[]
}

// Payload para que el superadmin provea el salario
export interface SalarioPayload {
  salario_base: number
  cargo: string
  sede?: string
}

// Payload para que el admin complete datos operacionales del ROI
export interface DatosOperacionalesPayload {
  num_personas: number
  horas_proceso_actual: number
  horas_proceso_nuevo: number
  observacion?: string
}
