// frontend/src/components/layout/AppLayout.tsx
import { Outlet, useLocation } from "react-router-dom"
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"
import MobileNav from "./MobileNav"
import ToastContainer from "@/components/ui/ToastContainer"
import { useWebSocket } from "@/hooks/useWebSocket"

const ROUTE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/":                 { title: "Dashboard",          subtitle: "Resumen general" },
  "/projects":         { title: "Proyectos",          subtitle: "Gestión de proyectos" },
  "/mis-proyectos":    { title: "Mis Proyectos",      subtitle: "Estado de tus solicitudes" },
  "/matrix":           { title: "Matriz Estratégica", subtitle: "Posicionamiento de proyectos" },
  "/settings":         { title: "Configuración",      subtitle: "Solo administradores" },
}

function getRouteInfo(pathname: string) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  if (pathname.startsWith("/projects/")) return { title: "Detalle del Proyecto", subtitle: "Evaluación y comentarios" }
  return { title: "Project Matrix" }
}

export default function AppLayout() {
  const location = useLocation()
  const { title, subtitle } = getRouteInfo(location.pathname)
  useWebSocket()

  return (
    <div className="flex h-screen bg-navy-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <MobileNav />
      <ToastContainer />
    </div>
  )
}
