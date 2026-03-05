export interface User {
  id:        number
  email:     string
  full_name: string | null
  role:      "superadmin" | "admin" | "user"
  area:      string | null
  is_active: boolean
}

export interface TokenResponse {
  access_token: string
  token_type:   string
}
