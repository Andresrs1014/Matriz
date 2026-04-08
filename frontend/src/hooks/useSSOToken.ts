import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types/auth'

export function useSSOToken() {
  const location = useLocation()
  const navigate = useNavigate()
  const { token, setAuth } = useAuthStore()

  useEffect(() => {
    if (token) return // ya hay sesión activa, no hacer nada

    const params = new URLSearchParams(location.search)
    const ssoToken = params.get('sso_token')
    if (!ssoToken) return

    try {
      const payload = JSON.parse(atob(ssoToken.split('.')[1]))

      // Construir el user mínimo que espera el store de Matriz
      const user: User = {
        id: payload.id ?? 0,
        email: payload.sub,
        full_name: payload.full_name ?? null,
        role: payload.role ?? 'usuario',
        area: payload.area ?? null,
        is_active: true,
      }

      setAuth(user, ssoToken)

      // Limpiar el token de la URL
      params.delete('sso_token')
      navigate(
        { pathname: location.pathname, search: params.toString() },
        { replace: true }
      )
    } catch {
      // Token malformado — el usuario verá el login normal
    }
  }, [])
}