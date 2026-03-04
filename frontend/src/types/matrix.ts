import type { QuadrantKey } from "@/lib/constants"

export interface MatrixQuestion {
  id:     number
  key:    string
  axis:   "impact" | "effort"
  text:   string
  weight: number
  order:  number
}

export interface EvaluationResponseInput {
  question_id: number
  value:       1 | 2 | 3 | 4 | 5
}

export interface EvaluationSubmit {
  responses: EvaluationResponseInput[]
  notes?:    string
}

export interface EvaluationRead {
  id:                 number
  project_id:         number
  evaluator_user_id:  number | null
  impact_score:       number
  effort_score:       number
  quadrant:           QuadrantKey
  notes:              string | null
  created_at:         string
}

export interface MatrixPlotPoint {
  project_id:    number
  project_title: string
  impact_score:  number
  effort_score:  number
  quadrant:      QuadrantKey
  evaluation_id: number
  evaluated_at:  string
}

export interface QuadrantSummary {
  quadrant: QuadrantKey
  label:    string
  count:    number
  projects: string[]
}

export interface DashboardStats {
  total_projects:     number
  evaluated_projects: number
  pending_evaluation: number
  total_evaluations:  number
  by_quadrant:        Record<QuadrantKey, number>
}
