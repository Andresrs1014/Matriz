import { useState } from "react"
import { motion } from "framer-motion"
import { Target, RefreshCw, History } from "lucide-react"
import { useMatrix } from "@/hooks/useMatrix"
import MatrixPlot    from "@/components/matrix/MatrixPlot"
import MatrixFilters, { type FilterType } from "@/components/matrix/MatrixFilters"
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
import { cn } from "@/lib/utils"

export default function MatrixPage() {
  const { plotPoints, loading, fetchPlotPoints } = useMatrix()
  const [filter, setFilter] = useState<FilterType>("all")

  // Conteos por cuadrante para los filtros
  const counts = plotPoints.reduce<Record<string, number>>((acc, p) => {
    acc[p.quadrant] = (acc[p.quadrant] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Controles superiores */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <MatrixFilters active={filter} onChange={setFilter} counts={counts} />
        <button
          onClick={fetchPlotPoints}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white border border-navy-600 hover:border-navy-500 bg-navy-800 transition-all ml-auto disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Matriz SVG */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-card p-4 md:p-6"
      >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-electric rounded-full animate-spin border-t-transparent" />
          </div>
        ) : (
          <MatrixPlot points={plotPoints} filter={filter} />
        )}
      </motion.div>

      {/* Leyenda + lista de proyectos evaluados */}
      {plotPoints.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <History size={15} className="text-electric" />
            <p className="text-sm font-medium text-white">Proyectos posicionados</p>
            <span className="ml-auto text-xs text-slate-500">{plotPoints.length} evaluado{plotPoints.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {plotPoints
              .filter((p) => filter === "all" || p.quadrant === filter)
              .map((p) => {
                const config = QUADRANT_CONFIG[p.quadrant as QuadrantKey]
                return (
                  <div key={p.project_id} className={cn("p-3 rounded-lg border flex items-start gap-3", config.bgClass)}>
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0", config.bgClass, config.textClass)}>
                      {p.project_title.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-medium truncate">{p.project_title}</p>
                      <p className={cn("text-[10px] font-semibold", config.textClass)}>{config.label}</p>
                      <p className="text-slate-500 text-[10px] mt-0.5">
                        I: {p.impact_score.toFixed(0)} · E: {p.effort_score.toFixed(0)}
                      </p>
                    </div>
                  </div>
                )
              })}
          </div>
        </motion.div>
      )}

      {/* Estado vacío */}
      {plotPoints.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <Target size={36} className="text-navy-700 mb-3" />
          <p className="text-slate-400 text-sm">Ningún proyecto ha sido evaluado aún.</p>
          <p className="text-slate-600 text-xs mt-1">Ve a <span className="text-electric">Proyectos</span> y usa "Evaluar en Matriz".</p>
        </div>
      )}
    </div>
  )
}
