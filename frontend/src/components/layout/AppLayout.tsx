import { Outlet, useLocation } from "react-router-dom"
import Sidebar        from "./Sidebar"
import TopBar         from "./TopBar"
import MobileNav      from "./MobileNav"
import ToastContainer from "@/components/ui/ToastContainer"
import { useWebSocket } from "@/hooks/useWebSocket"

// Mapa de rutas a títulos dinámicos
const ROUTE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/":          { title: "Dashboard",           subtitle: "Resumen general"                          },
  "/projects":  { title: "Proyectos",           subtitle: "Gestión de proyectos"                     },
  "/matrix":    { title: "Matriz Estratégica",  subtitle: "Posicionamiento de proyectos"             },
  "/settings":  { title: "Configuración",       subtitle: "Solo administradores"                     },
}

function getRouteInfo(pathname: string) {
  // Ruta exacta
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  // Ruta de detalle /projects/:id
  if (pathname.startsWith("/projects/")) return { title: "Detalle del Proyecto", subtitle: "Historial y evaluaciones" }
  return { title: "Project Matrix" }
}

export default function AppLayout() {
  const location = useLocation()
  const { title, subtitle } = getRouteInfo(location.pathname)

  // WebSocket reactivo — una sola instancia para todo el layout
  useWebSocket()

  return (
    <div className="flex min-h-screen bg-navy-950">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} subtitle={subtitle} />

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 animate-fade-in">
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <ToastContainer />
    </div>
  )
}
