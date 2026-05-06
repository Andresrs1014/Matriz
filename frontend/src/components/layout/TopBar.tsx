import { Wifi, WifiOff } from "lucide-react"
import { useProjectStore } from "@/store/projectStore"
import { useAuthStore } from "@/store/authStore"
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/roles"
import { cn } from "@/lib/utils"

interface TopBarProps {
  title:     string
  subtitle?: string
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const wsConnected = useProjectStore((s) => s.wsConnected)
  const user        = useAuthStore((s) => s.user)

  return (
    <header className="h-16 bg-navy-900/80 backdrop-blur border-b border-navy-700 flex items-center px-6 gap-4 sticky top-0 z-30">

      <div className="flex-1">
        <h1 className="text-base font-semibold text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>

      {/* Badge de rol */}
      {user && (
        <span className={cn(
          "hidden sm:inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-full border",
          ROLE_COLORS[user.role]
        )}>
          {ROLE_LABELS[user.role]}
        </span>
      )}

      {/* Estado WebSocket */}
      <div className={cn(
        "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all",
        wsConnected
          ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
          : "text-slate-500 border-slate-700 bg-slate-800/50"
      )}>
        {wsConnected
          ? <><Wifi size={12} /><span>En vivo</span></>
          : <><WifiOff size={12} /><span>Offline</span></>
        }
      </div>

      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-electric/20 border border-electric/40 flex items-center justify-center">
        <span className="text-xs font-bold text-electric">
          {(user?.full_name ?? user?.email ?? "U")[0].toUpperCase()}
        </span>
      </div>
    </header>
  )
}
