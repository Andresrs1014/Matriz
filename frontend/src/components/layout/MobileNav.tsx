import { NavLink, useNavigate } from "react-router-dom"
import { LayoutDashboard, FolderKanban, Target, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/authStore"

const NAV_ITEMS = [
  { to: "/",         icon: LayoutDashboard, label: "Dashboard" },
  { to: "/projects", icon: FolderKanban,    label: "Proyectos" },
  { to: "/matrix",   icon: Target,          label: "Matriz"    },
]

export default function MobileNav() {
  const { clearAuth } = useAuthStore()
  const navigate = useNavigate()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-navy-900/95 backdrop-blur border-t border-navy-700">
      {/* Línea sable top */}
      <div className="laser-line-h w-full" />

      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs transition-all duration-200",
                isActive
                  ? "text-electric"
                  : "text-slate-500 hover:text-slate-300"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} className={cn(isActive && "drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]")} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        <button
          onClick={() => { clearAuth(); navigate("/login") }}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-xs text-slate-500 hover:text-red-400 transition-all"
        >
          <LogOut size={20} />
          <span>Salir</span>
        </button>
      </div>
    </nav>
  )
}
