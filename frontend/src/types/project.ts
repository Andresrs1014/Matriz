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
  okr_creator: string | null
  collaborators: string[]
  due_date: string | null
  okr_productive: boolean | null
  status: string
  source: string
  owner_id: number
  /** Área funcional del usuario dueño (catálogo); útil para filtrar vistas operativas */
  owner_work_area_id?: number | null
  owner_work_area_name?: string | null
  ms_list_id: string | null
  approved_by: number | null
  approved_at: string | null
  final_approved_by: number | null
  final_approved_at: string | null
  assigned_to_dev: boolean
  assigned_to_dev_at: string | null
  assigned_to_dev_by: number | null
  assigned_area_id: number | null
  assigned_area_at: string | null
  assigned_area_by: number | null
  assigned_area_name: string | null
  created_at: string
  updated_at: string
  /** Conteo de evidencias activas; ausente se trata como 0 */
  evidence_count?: number
  /** Calculado en backend: owner o equipo dev si assigned_to_dev */
  viewer_can_modify_tasks?: boolean
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
  okr_creator?: string
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
export interface CustomQuestionPayload {
  text: string
  axis: "impact" | "effort"
}

export interface SuperaprobacionPayload {
  question_ids: number[]
  custom_questions: CustomQuestionPayload[]
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

// Payload para que usuario/coordinador extienda la fecha de su propio proyecto
export interface DueDateExtendPayload {
  due_date: string // YYYY-MM-DD
  justificacion: string
}
