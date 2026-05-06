export interface User {
  id: number
  email: string
  full_name: string | null
  role: "superadmin" | "admin" | "coordinador" | "usuario"
  area: string | null
  site_name?: string | null
  work_area_id?: number | null
  work_site_id?: number | null
  is_active: boolean
}

export interface TokenResponse {
  access_token: string
  token_type:   string
}
