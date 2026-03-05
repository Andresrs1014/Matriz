export interface Category {
  id:             number
  name:           string
  description:    string | null
  is_active:      boolean
  is_default:     boolean
  question_count: number
}

export interface Question {
  id:          number
  category_id: number | null
  axis:        "impact" | "effort"
  text:        string
  weight:      number
  order:       number
  is_active:   boolean
}

export interface CategoryCreate {
  name:        string
  description?: string
  is_default:  boolean
}

export interface QuestionCreate {
  category_id?: number
  axis:         "impact" | "effort"
  text:         string
  weight:       number
  order:        number
}
