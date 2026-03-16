// frontend/src/types/matrix.ts
import type { QuadrantKey } from "@/lib/constants"

export interface CategoryRead {
  id: number
  name: string
  description: string | null
  is_default: boolean
}

export interface MatrixQuestion {
  id: number
  category_id: number | null
  axis: "impact" | "effort"
  text: string
  weight: number
  order: number
}

// ← CORREGIDO: ambos campos son opcionales/nullable para soportar preguntas custom
export interface EvaluationResponseInput {
  question_id: number | null          // null cuando es pregunta custom
  project_question_id?: number | null // id de ProjectQuestion (solo para custom)
  value: 1 | 2 | 3 | 4 | 5
}

export interface EvaluationSubmit {
  responses: EvaluationResponseInput[]
  category_id?: number
  notes?: string
}

export interface EvaluationRead {
  id: number
  project_id: number
  category_id: number | null
  impact_score: number
  effort_score: number
  quadrant: QuadrantKey
  notes: string | null
  created_at: string
}

export interface MatrixPlotPoint {
  project_id: number
  project_title: string
  impact_score: number
  effort_score: number
  quadrant: QuadrantKey
  evaluation_id: number
  evaluated_at: string
}

export interface QuadrantSummary {
  quadrant: QuadrantKey
  label: string
  count: number
  projects: string[]
}

export interface DashboardStats {
  total_projects: number
  evaluated_projects: number
  pending_evaluation: number
  total_evaluations: number
  by_quadrant: Record<QuadrantKey, number>
}
