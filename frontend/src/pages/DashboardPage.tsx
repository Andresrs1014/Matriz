import { motion } from "framer-motion"
import {
  FolderKanban, CheckCircle, Clock, BarChart2,
  Target, AlertCircle, ThumbsUp, ThumbsDown, CalendarClock,
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

      {/* Sección de Productividad OKR */}
      {stats.total_finalized > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Target size={16} className="text-electric" />
            <p className="text-sm font-medium text-white">Criterio de Productividad de OKRs</p>
            <span className="ml-auto text-xs text-slate-500">{stats.total_finalized} OKR{stats.total_finalized !== 1 ? "s" : ""} finalizados</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <ThumbsUp className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-lg font-bold text-emerald-300">{stats.productive_count}</p>
                <p className="text-xs text-emerald-500">Productivos</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <ThumbsDown className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-lg font-bold text-red-300">{stats.not_productive_count}</p>
                <p className="text-xs text-red-500">No productivos</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-700/40 border border-slate-600/30">
              <Clock className="w-5 h-5 text-slate-400 shrink-0" />
              <div>
                <p className="text-lg font-bold text-slate-300">{stats.pending_productivity}</p>
                <p className="text-xs text-slate-500">Sin criterio</p>
              </div>
            </div>
          </div>

          {/* Barra de productividad */}
          {stats.total_finalized > 0 && (
            <div className="space-y-1.5">
              <div className="w-full h-2 bg-navy-700 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${(stats.productive_count / stats.total_finalized) * 100}%` }}
                />
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${(stats.not_productive_count / stats.total_finalized) * 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {stats.total_finalized > 0
                  ? `${Math.round((stats.productive_count / stats.total_finalized) * 100)}% de OKRs finalizados fueron productivos`
                  : ""}
              </p>
            </div>
          )}

          {/* Fechas de vencimiento */}
          <div className="flex gap-3 pt-1">
            {stats.expired_okrs > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-400">
                <CalendarClock className="w-3.5 h-3.5" />
                {stats.expired_okrs} OKR{stats.expired_okrs !== 1 ? "s" : ""} con fecha vencida
              </div>
            )}
            {stats.upcoming_okrs > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <CalendarClock className="w-3.5 h-3.5" />
                {stats.upcoming_okrs} OKR{stats.upcoming_okrs !== 1 ? "s" : ""} con fecha activa
              </div>
            )}
          </div>
        </motion.div>
      )}

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
