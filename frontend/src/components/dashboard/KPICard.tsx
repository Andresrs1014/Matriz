import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface KPICardProps {
  label:     string
  value:     number | string
  icon:      LucideIcon
  color:     "blue" | "cyan" | "indigo" | "emerald" | "red" | "slate"
  delay?:    number
  suffix?:   string
}

const COLOR_MAP = {
  blue:    { icon: "text-electric",   bg: "bg-electric/10",   border: "border-electric/20",   glow: "hover:shadow-glow-blue"   },
  cyan:    { icon: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/20",   glow: "hover:shadow-glow-cyan"   },
  indigo:  { icon: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", glow: "hover:shadow-glow-indigo" },
  emerald: { icon: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/20",glow: ""                         },
  red:     { icon: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    glow: ""                         },
  slate:   { icon: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/20",  glow: ""                         },
}

export default function KPICard({ label, value, icon: Icon, color, delay = 0, suffix }: KPICardProps) {
  const c = COLOR_MAP[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn("glass-card p-5 transition-all duration-300", c.glow)}
    >
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", c.bg, c.border)}>
          <Icon size={15} className={c.icon} />
        </div>
      </div>
      <div className="flex items-end gap-1">
        <span className={cn("text-3xl font-bold", c.icon)}>{value}</span>
        {suffix && <span className="text-slate-500 text-sm mb-1">{suffix}</span>}
      </div>
    </motion.div>
  )
}
