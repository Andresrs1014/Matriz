import { motion } from "framer-motion"
import {
  FolderKanban, CheckCircle, Clock, BarChart2,
  Target, TrendingUp, Zap, AlertCircle
} from "lucide-react"
import { useDashboard } from "@/hooks/useDashboard"
import KPICard           from "@/components/dashboard/KPICard"
import QuadrantBarChart  from "@/components/dashboard/QuadrantBarChart"
import { QUADRANT_CONFIG } from "@/lib/constants"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const { stats, summary, loading } = useDashboard()

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-electric rounded-full animate-spin border-t-transparent" />
      </div>
    )
  }

  const evalPct = stats.total_projects > 0
    ? Math.round((stats.evaluated_projects / stats.total_projects) * 100)
    : 0

  return (
    <div className="p-6 mx-auto w-full max-w-[1610px] space-y-6 animate-fade-in">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total proyectos"      value={stats.total_projects}     icon={FolderKanban}  color="blue"    delay={0}    />
        <KPICard label="Evaluados"            value={stats.evaluated_projects} icon={CheckCircle}   color="emerald" delay={0.05} />
        <KPICard label="Sin evaluar"          value={stats.pending_evaluation} icon={Clock}         color="red"     delay={0.1}  />
        <KPICard label="Total evaluaciones"   value={stats.total_evaluations}  icon={BarChart2}     color="indigo"  delay={0.15} />
      </div>

      {/* Barra de progreso de evaluación */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-white">Cobertura de evaluación</p>
          <span className="text-sm font-bold text-electric">{evalPct}%</span>
        </div>
        <div className="w-full h-2 bg-navy-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-electric to-cyan-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${evalPct}%` }}
            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {stats.evaluated_projects} de {stats.total_projects} proyectos han sido evaluados en la matriz
        </p>
      </motion.div>

      {/* Grid: gráfica + cuadrantes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Gráfica por cuadrante */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 size={16} className="text-electric" />
            <p className="text-sm font-medium text-white">Distribución por cuadrante</p>
          </div>
          {summary.length > 0
            ? <QuadrantBarChart data={summary} />
            : <p className="text-slate-500 text-xs text-center py-8">Evalúa proyectos para ver la distribución</p>
          }
        </motion.div>

        {/* Detalle por cuadrante */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-5">
            <Target size={16} className="text-electric" />
            <p className="text-sm font-medium text-white">Proyectos por cuadrante</p>
          </div>
          <div className="space-y-3">
            {summary.map((s) => {
              const config = QUADRANT_CONFIG[s.quadrant]
              return (
                <div key={s.quadrant} className={cn("p-3 rounded-lg border", config.bgClass)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-xs font-semibold", config.textClass)}>{config.label}</span>
                    <span className={cn("text-xs font-bold", config.textClass)}>{s.count}</span>
                  </div>
                  {s.projects.length > 0 && (
                    <p className="text-xs text-slate-400 truncate">
                      {s.projects.join(" · ")}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* Alerta si hay proyectos sin evaluar */}
      {stats.pending_evaluation > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25"
        >
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              {stats.pending_evaluation} proyecto{stats.pending_evaluation > 1 ? "s" : ""} sin evaluar
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Ve a <span className="font-semibold">Proyectos</span> y usa "Evaluar en Matriz" para posicionarlos en la matriz estratégica.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
