import axios from "axios"
import type { AxiosError, InternalAxiosRequestConfig } from "axios"
import { API_BASE } from "@/lib/constants"

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
})

// Inyecta el token JWT en cada request automáticamente
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Multipart: el default "application/json" impide que Axios inserte boundary → subidas rotas.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"]
  }
  // Descargas / binarios: no enviar Content-Type JSON en GET (algunos endpoints lo toleran mal).
  const method = (config.method ?? "get").toLowerCase()
  if (method === "get" || method === "head") {
    delete config.headers["Content-Type"]
  }

  const raw = localStorage.getItem("auth-storage")
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      const token = parsed?.state?.token
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // token corrupto — se ignora
    }
  }
  return config
})

// Errores con responseType blob traen JSON en el cuerpo — parsear para toasts y flujos correctos
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const res = error.response
    if (res?.data instanceof Blob) {
      try {
        const text = await res.data.text()
        try {
          ;(res as { data: unknown }).data = JSON.parse(text)
        } catch {
          ;(res as { data: unknown }).data = { detail: text || `Error ${res.status}` }
        }
      } catch {
        ;(res as { data: unknown }).data = { detail: "Error al leer respuesta del servidor." }
      }
    }
    if (res?.status === 401) {
      localStorage.removeItem("auth-storage")
      alert("Tu sesión ha expirado. Por favor inicia sesión nuevamente.")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)

export default api
