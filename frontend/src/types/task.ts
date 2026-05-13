export type TaskPriority = "urgente" | "alta" | "media" | "baja"
export type TaskStatus = "pendiente" | "en_progreso" | "completada" | "cancelada"

export interface ChecklistItem {
  id: number
  task_id: number
  text: string
  is_done: boolean
  sort_order: number
}

export interface ProjectTask {
  id: number
  project_id: number
  created_by: number
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  due_date: string | null
  sort_order: number
  evidence_hint: string
  completed_at: string | null
  completed_by: number | null
  created_at: string
  updated_at: string
  checklist_items: ChecklistItem[]
  checklist_total: number
  checklist_done: number
}

export interface ProjectProgress {
  project_id: number
  total_tasks: number
  completed_tasks: number
  progress_pct: number
}

export interface TaskCreate {
  title: string
  description?: string
  priority?: TaskPriority
  due_date?: string
  sort_order?: number
  checklist_items?: { text: string; sort_order?: number }[]
}

export interface TaskUpdate {
  title?: string
  description?: string
  priority?: TaskPriority
  due_date?: string | null
  status?: TaskStatus
  sort_order?: number
}
