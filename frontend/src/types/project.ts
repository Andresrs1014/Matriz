export interface Project {
  id:                 number
  title:              string
  description:        string | null
  status:             string
  source:             string
  owner_id:           number
  ms_list_id:         string | null
  approved_by:        number | null
  approved_at:        string | null
  final_approved_by:  number | null
  final_approved_at:  string | null
  created_at:         string
  updated_at:         string
}

export interface ProjectCreate {
  title:       string
  description?: string
}
