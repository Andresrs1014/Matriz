export type ProjectStatus = "nuevo" | "en_progreso" | "completado" | "cancelado"
export type ProjectSource = "manual" | "list"

export interface Project {
  id:          number
  title:       string
  description: string | null
  status:      ProjectStatus
  owner_id:    number
  source:      ProjectSource
  ms_list_id:  string | null
  created_at:  string
  updated_at:  string
}

export interface ProjectCreate {
  title:       string
  description?: string
  status?:     ProjectStatus
}
