export interface User {
  email: string
  full_name: string | null
  role:      string
  is_active: boolean
}

export interface AuthState {
  user:            User | null
  token:           string | null
  isAuthenticated: boolean
}
