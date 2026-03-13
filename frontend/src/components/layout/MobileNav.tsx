// frontend/src/components/layout/MobileNav.tsx
import { NavLink, useNavigate } from "react-router-dom"
import { FolderKanban, Target, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/authStore"
import { isUsuario } from "@/lib/roles"

export default function MobileNav() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const esUsuario = isUsuario(user)

  const navItems = [
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
      show: !esUsuario,
    },
  ].filter((item) => item.show)

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-navy-900/95 backdrop-blur border-t border-navy-700/50 flex items-center justify-around px-4 py-2">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to}
          className={({ isActive }) => cn(
            "flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs transition-all",
            isActive ? "text-electric" : "text-slate-500 hover:text-slate-300"
          )}>
          {({ isActive }) => (
            <>
              <Icon className={cn("w-5 h-5", isActive && "text-electric")} />
              {label}
            </>
          )}
        </NavLink>
      ))}
      <button
        onClick={() => { clearAuth(); navigate("/login") }}
        className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs text-slate-500 hover:text-red-400 transition-all"
      >
        <LogOut className="w-5 h-5" />
        Salir
      </button>
    </nav>
  )
}
