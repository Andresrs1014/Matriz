import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Target, RefreshCw, History, DollarSign, X, Clock, TrendingUp, Users, Zap } from "lucide-react"
import { useMatrix }   from "@/hooks/useMatrix"
import { useROIPlot }  from "@/hooks/useROI"
import MatrixPlot      from "@/components/matrix/MatrixPlot"
import MatrixFilters, { type FilterType } from "@/components/matrix/MatrixFilters"
import ROIMatrixPlot   from "@/components/roi/ROIMatrixPlot"
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
import { ROI_QUADRANT_CONFIG, type ROICuadranteKey } from "@/types/roi"
import type { ROIPlotPoint } from "@/types/roi"
import { cn } from "@/lib/utils"

type TabKey = "operacional" | "roi"

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0
  }).format(n)
}
function fmtNum(n: number, d = 1) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: d }).format(n)
}

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "operacional", label: "Operacional", icon: <Target size={13} /> },
  { key: "roi",         label: "ROI",         icon: <DollarSign size={13} /> },
]

export default function MatrixPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get("tab") as TabKey) ?? "operacional"

  const [tab,      setTab]      = useState<TabKey>(initialTab)
  const [filter,   setFilter]   = useState<FilterType>("all")
  const [selected, setSelected] = useState<ROIPlotPoint | null>(null)

  const { plotPoints,    loading: loadingOp,  fetchPlotPoints } = useMatrix()
  const { roiPlotPoints, loading: loadingROI, fetchROIPlot }    = useROIPlot()

  // Sincronizar tab con URL
  function handleTabChange(t: TabKey) {
    setTab(t)
    setSearchParams({ tab: t })
    setSelected(null)
  }

  useEffect(() => {
    if (tab === "roi" && roiPlotPoints.length === 0) fetchROIPlot()
  }, [tab]) // eslint-disable-line

  const opCounts = plotPoints.reduce<Record<string, number>>((acc, p) => {
    acc[p.quadrant] = (acc[p.quadrant] ?? 0) + 1
    return acc
  }, {})

  const loading = tab === "operacional" ? loadingOp : loadingROI

  function handleRefresh() {
    tab === "operacional" ? fetchPlotPoints() : fetchROIPlot()
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Tabs + controles */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-navy-900 border border-navy-700 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === t.key ? "bg-electric text-white shadow" : "text-slate-400 hover:text-white"
              )}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {tab === "operacional" && (
          <MatrixFilters active={filter} onChange={setFilter} counts={opCounts} />
        )}

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400
                     hover:text-white border border-navy-600 hover:border-navy-500 bg-navy-800
                     transition-all ml-auto disabled:opacity-40"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* ── TAB OPERACIONAL ── */}
      {tab === "operacional" && (
        <>
          <motion.div key="op-plot" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }} className="glass-card p-4 md:p-6">
            {loadingOp ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-6 h-6 border-2 border-electric rounded-full animate-spin border-t-transparent" />
              </div>
            ) : (
              <MatrixPlot points={plotPoints} filter={filter} />
            )}
          </motion.div>

          {plotPoints.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <History size={15} className="text-electric" />
                <p className="text-sm font-medium text-white">Proyectos posicionados</p>
                <span className="ml-auto text-xs text-slate-500">
                  {plotPoints.length} evaluado{plotPoints.length !== 1 ? "s" : ""}
                </span>
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

          {plotPoints.length === 0 && !loadingOp && (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Target size={36} className="text-navy-700 mb-3" />
              <p className="text-slate-400 text-sm">Ningún proyecto ha sido evaluado aún.</p>
              <p className="text-slate-600 text-xs mt-1">
                Ve a <span className="text-electric">Proyectos</span> y usa "Evaluar en Matriz".
              </p>
            </div>
          )}
        </>
      )}

      {/* ── TAB ROI ── */}
      {tab === "roi" && (
        <>
          {/* Matriz + panel lateral */}
          <div className="flex gap-4 items-start">

            {/* Matriz — se encoge cuando hay panel abierto */}
            <motion.div
              layout
              className="glass-card p-4 md:p-6 flex-1 min-w-0"
            >
              {loadingROI ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-6 h-6 border-2 border-emerald-400 rounded-full animate-spin border-t-transparent" />
                </div>
              ) : roiPlotPoints.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-center">
                  <DollarSign size={36} className="text-navy-700 mb-3" />
                  <p className="text-slate-400 text-sm">Aún no hay evaluaciones ROI.</p>
                  <p className="text-slate-600 text-xs mt-1">
                    Ve al detalle de un proyecto y usa "Evaluar ROI".
                  </p>
                </div>
              ) : (
                <ROIMatrixPlot
                  points={roiPlotPoints}
                  selectedId={selected?.roi_id ?? null}
                  onSelect={setSelected}
                />
              )}
            </motion.div>

            {/* Panel lateral — aparece al hacer click en un punto */}
            <AnimatePresence>
              {selected && (
                <motion.div
                  key="roi-panel"
                  initial={{ opacity: 0, x: 40, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 300 }}
                  exit={{ opacity: 0, x: 40, width: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="glass-card p-5 flex-shrink-0 overflow-hidden"
                  style={{ width: 300 }}
                >
                  <ROIProjectPanel point={selected} onClose={() => setSelected(null)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Lista de proyectos ROI */}
          {roiPlotPoints.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign size={15} className="text-emerald-400" />
                <p className="text-sm font-medium text-white">Proyectos con ROI evaluado</p>
                <span className="ml-auto text-xs text-slate-500">
                  {roiPlotPoints.length} proyecto{roiPlotPoints.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {roiPlotPoints.map((p) => {
                  const config = ROI_QUADRANT_CONFIG[p.cuadrante_roi as ROICuadranteKey]
                  const isSelected = selected?.roi_id === p.roi_id
                  return (
                    <button
                      key={p.roi_id}
                      onClick={() => setSelected(isSelected ? null : p)}
                      className={cn(
                        "p-3 rounded-lg border flex items-start gap-3 text-left transition-all",
                        config.bgClass, config.borderClass,
                        isSelected && "ring-2 ring-electric"
                      )}
                    >
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0", config.bgClass)}>
                        <span className={config.textClass}>{p.project_title.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-xs font-medium truncate">{p.project_title}</p>
                        <p className={cn("text-[10px] font-semibold", config.textClass)}>{config.label}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5">
                          ROI: {p.roi_pct.toFixed(1)}% · Ahorro: {p.horas_ahorradas.toFixed(1)}h
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

// ── Panel lateral de detalle por proyecto ─────────────────────────────────────
function ROIProjectPanel({ point, onClose }: { point: ROIPlotPoint; onClose: () => void }) {
  const config        = ROI_QUADRANT_CONFIG[point.cuadrante_roi as ROICuadranteKey]
  const reduccionPct  = point.horas_proceso_actual > 0
    ? ((point.horas_ahorradas / point.horas_proceso_actual) * 100).toFixed(1)
    : "0"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white text-sm font-semibold leading-tight">{point.project_title}</p>
          <p className={cn("text-xs font-medium mt-0.5", config.textClass)}>{config.label}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
          <X size={15} />
        </button>
      </div>

      <div className={cn("rounded-lg p-2.5 border text-center text-xs font-semibold", config.bgClass, config.borderClass, config.textClass)}>
        {config.action}
      </div>

      {/* Métricas */}
      <div className="space-y-2">
        <MetricRow icon={<TrendingUp size={12} className="text-emerald-400" />}
          label="ROI calculado" value={`${point.roi_pct.toFixed(1)}%`} color="text-emerald-400" />

        <MetricRow icon={<Clock size={12} className="text-amber-400" />}
          label="Horas ahorradas" value={`${fmtNum(point.horas_ahorradas)} h`} color="text-amber-400" />

        <MetricRow icon={<DollarSign size={12} className="text-cyan-400" />}
          label="Ahorro en COP" value={fmtCOP(point.roi_valor_total)} color="text-cyan-400" />

        <MetricRow icon={<Users size={12} className="text-indigo-400" />}
          label="Personas impactadas" value={`${point.num_personas}`} color="text-indigo-400" />

        <MetricRow icon={<Zap size={12} className="text-rose-400" />}
          label="Reducción del proceso" value={`${reduccionPct}%`} color="text-rose-400" />

        <MetricRow icon={<Clock size={12} className="text-slate-400" />}
          label="Proceso actual" value={`${point.horas_proceso_actual} h`} color="text-slate-300" />
      </div>

      {/* Barra de progreso visual */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>Horas actuales</span>
          <span>Proyectadas</span>
        </div>
        <div className="h-2 rounded-full bg-navy-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all"
            style={{ width: `${Math.min(parseFloat(reduccionPct), 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 mt-1 text-right">{reduccionPct}% del proceso optimizado</p>
      </div>
    </div>
  )
}

function MetricRow({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string
}) {
  return (
    <div className="flex items-center justify-between bg-navy-800/50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] text-slate-400">{label}</span>
      </div>
      <span className={cn("text-[11px] font-semibold", color)}>{value}</span>
    </div>
  )
}
