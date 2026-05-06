// frontend/src/components/layout/Sidebar.tsx
import { useEffect, useState } from "react"
import { NavLink } from "react-router-dom"
import {
  LayoutDashboard, FolderKanban, Target,
  Settings, LogOut, Zap,
} from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { isUsuario, canAccessSettings } from "@/lib/roles"
import { cn } from "@/lib/utils"
import api from "@/lib/api"

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const esUsuario = isUsuario(user)
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    api.get("/health").then(({ data }) => setVersion(data.version)).catch(() => {})
  }, [])

  const navItems = [
    {
      to: "/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      show: true,
    },
    {
      to: esUsuario ? "/mis-proyectos" : "/projects",
      icon: FolderKanban,
      label: esUsuario ? "Mis Proyectos" : "Proyectos",
      show: true,
    },
    {
      to: "/matrix",
      icon: Target,
      label: "Matriz",
      show: !esUsuario,   // ← oculto para usuario
    },
    {
      to: "/settings",
      icon: Settings,
      label: "Configuración",
      show: canAccessSettings(user),
    },
  ].filter((item) => item.show)

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-navy-900 border-r border-navy-700/50 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-navy-700/50">
        <div className="w-8 h-8 rounded-lg bg-electric/20 border border-electric/30 flex items-center justify-center">
          <Zap className="w-4 h-4 text-electric" />
        </div>
        <div className="flex flex-col">
          <span className="text-white font-bold text-sm tracking-tight">Project Matrix</span>
          {version && <span className="text-[10px] text-slate-500">v{version}</span>}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive
                ? "bg-electric/10 text-electric border border-electric/20"
                : "text-slate-400 hover:text-white hover:bg-navy-800"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-navy-700/50 space-y-2">
        <div className="px-3 py-2 rounded-lg bg-navy-800/60">
          <div className="flex items-center gap-2">
            <img
              src="/zymo01.png"
              alt="avatar"
              className="w-6 h-6 rounded-full border border-slate-600 bg-white object-cover"
              style={{ background: 'black' }}
            />
            <span className="text-xs font-medium text-white truncate">
              {user?.full_name ?? user?.email}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 capitalize mt-0.5">{user?.role}</p>
        </div>
        <button
          onClick={clearAuth}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
