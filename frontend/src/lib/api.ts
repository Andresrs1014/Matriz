import axios from "axios"
import { API_BASE } from "@/lib/constants"

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
})

// Inyecta el token JWT en cada request automáticamente
api.interceptors.request.use((config) => {
  const raw = localStorage.getItem("auth-storage")
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      const token  = parsed?.state?.token
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // token corrupto — se ignora
    }
  }
  return config
})

// Redirige al login si el token expira
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("auth-storage")
      alert("Tu sesión ha expirado. Por favor inicia sesión nuevamente.")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

export default api
