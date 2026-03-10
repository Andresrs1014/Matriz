import { NavLink, useNavigate } from "react-router-dom"
import { LayoutDashboard, FolderKanban, Target, Settings, LogOut, Zap, Users } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/authStore"
import { canAccessSettings, isAdmin, ROLE_LABELS, ROLE_COLORS } from "@/lib/roles"
import type { Role } from "@/lib/roles"

const BASE_NAV = [
  { to: "/",         icon: LayoutDashboard, label: "Dashboard"  },
  { to: "/projects", icon: FolderKanban,    label: "Proyectos"  },
  { to: "/matrix",   icon: Target,          label: "Matriz"     },
]

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const navItems = [
    ...BASE_NAV,
    ...(canAccessSettings(user) ? [{ to: "/settings", icon: Settings, label: "Configuración" }] : []),
    ...(isAdmin(user)           ? [{ to: "/users",    icon: Users,    label: "Usuarios"       }] : []),
  ]

  const role      = (user?.role ?? "usuario") as Role
  const roleLabel = ROLE_LABELS[role]
  const roleColor = ROLE_COLORS[role]

  function handleLogout() {
    clearAuth()
    navigate("/login")
  }

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-navy-900 border-r border-navy-700 relative">
      <div className="laser-line-v absolute right-0 top-0 h-full opacity-60" />

      {/* Logo */}
      <div className="px-6 py-6 border-b border-navy-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-electric/20 border border-electric/40 flex items-center justify-center shadow-glow-blue">
            <Zap size={16} className="text-electric" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Project Matrix</p>
            <p className="text-xs text-electric/70">Beta v0.1</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                isActive
                  ? "bg-electric/15 text-electric border border-electric/30 shadow-glow-blue"
                  : "text-slate-400 hover:text-white hover:bg-navy-800"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-electric/10 rounded-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon size={18} className="relative z-10 flex-shrink-0" />
                <span className="relative z-10">{label}</span>
                {isActive && (
                  <div className="laser-line-v absolute right-0 top-2 bottom-2 opacity-80" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Usuario + Rol + Logout */}
      <div className="px-3 py-4 border-t border-navy-700">
        <div className="px-4 py-3 rounded-lg bg-navy-800 mb-2">
          <p className="text-xs text-slate-400 truncate">Conectado como</p>
          <p className="text-sm text-white font-medium truncate">{user?.full_name ?? user?.email}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", roleColor)}>
              {roleLabel}
            </span>
            {user?.area && (
              <span className="text-[10px] text-slate-500 truncate">{user.area}</span>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
