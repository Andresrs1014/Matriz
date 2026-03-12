import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Target, RefreshCw, History, DollarSign,
  X, Clock, TrendingUp, Users, Zap, BarChart2, ChevronRight
} from "lucide-react"
import { useMatrix }   from "@/hooks/useMatrix"
import { useROIPlot }  from "@/hooks/useROI"
import MatrixPlot      from "@/components/matrix/MatrixPlot"
import MatrixFilters, { type FilterType } from "@/components/matrix/MatrixFilters"
import ROIMatrixPlot   from "@/components/roi/ROIMatrixPlot"
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
import { ROI_QUADRANT_CONFIG, type ROICuadranteKey } from "@/types/roi"
import type { ROIPlotPoint } from "@/types/roi"
import type { MatrixPlotPoint } from "@/types/matrix"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/authStore"
import { isAdmin, isCoordinador } from "@/lib/roles"

type TabKey = "operacional" | "roi"

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0
  }).format(n)
}
function fmtNum(n: number, d = 1) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: d }).format(n)
}

const ALL_TABS: { key: TabKey; label: string; icon: React.ReactElement }[] = [
  { key: "operacional", label: "Operacional", icon: <Target size={13} /> },
  { key: "roi",         label: "ROI",         icon: <DollarSign size={13} /> },
]


const PANEL_WIDTH = 288   // px — ancho fijo del panel lateral

export default function MatrixPage() {
  const { user } = useAuthStore()
  const canSeeROI = isAdmin(user) || isCoordinador(user)
  const availableTabs = canSeeROI ? ALL_TABS : ALL_TABS.filter((t) => t.key === "operacional")

  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get("tab") as TabKey) ?? "operacional"
  const safeInitialTab: TabKey = !canSeeROI && initialTab === "roi" ? "operacional" : initialTab

  const [tab,    setTab]    = useState<TabKey>(safeInitialTab)
  const [filter, setFilter] = useState<FilterType>("all")
  const [selOp,  setSelOp]  = useState<MatrixPlotPoint | null>(null)
  const [selRoi, setSelRoi] = useState<ROIPlotPoint    | null>(null)

  const { plotPoints,    loading: loadingOp,  fetchPlotPoints } = useMatrix()
  const { roiPlotPoints, loading: loadingROI, fetchROIPlot }    = useROIPlot()

  // Guard: si el usuario pierde acceso a ROI, redirige a operacional
  useEffect(() => {
    if (!canSeeROI && tab === "roi") {
      setTab("operacional")
      setSearchParams({ tab: "operacional" })
    }
  }, [canSeeROI]) // eslint-disable-line

  function handleTabChange(t: TabKey) {
    setTab(t)
    setSearchParams({ tab: t })
    setSelOp(null)
    setSelRoi(null)
  }

  useEffect(() => {
    if (tab === "roi" && canSeeROI && roiPlotPoints.length === 0) fetchROIPlot()
  }, [tab]) // eslint-disable-line

  const opCounts = plotPoints.reduce<Record<string, number>>((acc, p) => {
    acc[p.quadrant] = (acc[p.quadrant] ?? 0) + 1
    return acc
  }, {})

  const loading = tab === "operacional" ? loadingOp : loadingROI

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header: Tabs + filtros + refresh ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-navy-900 border border-navy-700 rounded-xl p-1">
          {availableTabs.map((t) => (
            <button key={t.key} onClick={() => handleTabChange(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                tab === t.key ? "bg-electric text-white shadow" : "text-slate-400 hover:text-white"
              )}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {tab === "operacional" && (
          <MatrixFilters active={filter} onChange={setFilter} counts={opCounts} />
        )}

        <button onClick={() => tab === "operacional" ? fetchPlotPoints() : fetchROIPlot()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400
                     hover:text-white border border-navy-600 hover:border-navy-500 bg-navy-800
                     transition-all ml-auto disabled:opacity-40">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB OPERACIONAL
      ══════════════════════════════════════════════════════ */}
      {tab === "operacional" && (
        <>
          {/* Matriz + panel lateral */}
          <motion.div key="op-wrap" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }} className="flex gap-4 items-start">

            {/* Matriz operacional */}
            <motion.div layout className="glass-card p-4 md:p-6 flex-1 min-w-0">
              {loadingOp ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-6 h-6 border-2 border-electric rounded-full animate-spin border-t-transparent" />
                </div>
              ) : plotPoints.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Target size={36} className="text-navy-700 mb-3" />
                  <p className="text-slate-400 text-sm">Ningún proyecto ha sido evaluado aún.</p>
                  <p className="text-slate-600 text-xs mt-1">Ve a <span className="text-electric">Proyectos</span> y usa "Evaluar en Matriz".</p>
                </div>
              ) : (
                <MatrixPlot
                  points={plotPoints}
                  filter={filter}
                  selectedId={selOp?.project_id ?? null}
                  onSelect={(p) => setSelOp(selOp?.project_id === p.project_id ? null : p)}
                />
              )}
            </motion.div>

            {/* Panel lateral operacional */}
            <AnimatePresence>
              {selOp && (
                <motion.div key="op-panel"
                  initial={{ opacity: 0, x: 40, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: PANEL_WIDTH }}
                  exit={{ opacity: 0, x: 40, width: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="glass-card p-5 flex-shrink-0 overflow-hidden"
                  style={{ width: PANEL_WIDTH }}
                >
                  <OpProjectPanel point={selOp} onClose={() => setSelOp(null)} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Lista proyectos operacional */}
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
                {plotPoints.filter((p) => filter === "all" || p.quadrant === filter).map((p) => {
                  const config  = QUADRANT_CONFIG[p.quadrant as QuadrantKey]
                  const isSel   = selOp?.project_id === p.project_id
                  return (
                    <button key={p.project_id} onClick={() => setSelOp(isSel ? null : p)}
                      className={cn("p-3 rounded-lg border flex items-start gap-3 text-left transition-all",
                        config.bgClass, isSel && "ring-2 ring-electric")}>
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0", config.bgClass, config.textClass)}>
                        {p.project_title.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-xs font-medium truncate">{p.project_title}</p>
                        <p className={cn("text-[10px] font-semibold", config.textClass)}>{config.label}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5">I: {p.impact_score.toFixed(0)} · E: {p.effort_score.toFixed(0)}</p>
                      </div>
                      <ChevronRight size={12} className={cn("flex-shrink-0 mt-1 transition-colors", isSel ? "text-electric" : "text-slate-600")} />
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB ROI
      ══════════════════════════════════════════════════════ */}
      {tab === "roi" && canSeeROI && (
        <>
          {/* Matriz ROI + panel lateral */}
          <div className="flex gap-4 items-start">

            <motion.div layout className="glass-card p-4 md:p-6 flex-1 min-w-0">
              {loadingROI ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-6 h-6 border-2 border-emerald-400 rounded-full animate-spin border-t-transparent" />
                </div>
              ) : roiPlotPoints.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-center">
                  <DollarSign size={36} className="text-navy-700 mb-3" />
                  <p className="text-slate-400 text-sm">Aún no hay evaluaciones ROI.</p>
                  <p className="text-slate-600 text-xs mt-1">Ve al detalle de un proyecto y usa "Evaluar ROI".</p>
                </div>
              ) : (
                <ROIMatrixPlot
                  points={roiPlotPoints}
                  selectedId={selRoi?.roi_id ?? null}
                  onSelect={(p) => setSelRoi(selRoi?.roi_id === p.roi_id ? null : p)}
                />
              )}
            </motion.div>

            {/* Panel lateral ROI */}
            <AnimatePresence>
              {selRoi && (
                <motion.div key="roi-panel"
                  initial={{ opacity: 0, x: 40, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: PANEL_WIDTH }}
                  exit={{ opacity: 0, x: 40, width: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="glass-card p-5 flex-shrink-0 overflow-hidden"
                  style={{ width: PANEL_WIDTH }}
                >
                  <ROIProjectPanel point={selRoi} onClose={() => setSelRoi(null)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Lista proyectos ROI */}
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
                  const isSel  = selRoi?.roi_id === p.roi_id
                  return (
                    <button key={p.roi_id} onClick={() => setSelRoi(isSel ? null : p)}
                      className={cn("p-3 rounded-lg border flex items-start gap-3 text-left transition-all",
                        config.bgClass, config.borderClass, isSel && "ring-2 ring-electric")}>
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0", config.bgClass)}>
                        <span className={config.textClass}>{p.project_title.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-xs font-medium truncate">{p.project_title}</p>
                        <p className={cn("text-[10px] font-semibold", config.textClass)}>{config.label}</p>
                        <p className="text-slate-500 text-[10px] mt-0.5">
                          ROI: {p.roi_pct.toFixed(1)}% · Ahorro: {p.horas_ahorradas.toFixed(1)}h
                        </p>
                      </div>
                      <ChevronRight size={12} className={cn("flex-shrink-0 mt-1 transition-colors", isSel ? "text-electric" : "text-slate-600")} />
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

// ══════════════════════════════════════════════════════════
// Panel lateral — Matriz Operacional
// ══════════════════════════════════════════════════════════
function OpProjectPanel({ point, onClose }: { point: MatrixPlotPoint; onClose: () => void }) {
  const config = QUADRANT_CONFIG[point.quadrant as QuadrantKey]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white text-sm font-semibold leading-tight">{point.project_title}</p>
          <p className={cn("text-xs font-medium mt-0.5", config.textClass)}>{config.label}</p>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors flex-shrink-0">
          <X size={15} />
        </button>
      </div>

      <div className={cn("rounded-lg p-2.5 border text-center text-xs font-semibold", config.bgClass, config.textClass)}>
        {config.label}
      </div>

      <div className="space-y-2">
        <MetricRow
          icon={<BarChart2 size={12} className="text-electric" />}
          label="Score de Impacto"
          value={`${point.impact_score.toFixed(1)} / 100`}
          color="text-electric"
        />
        <MetricRow
          icon={<Zap size={12} className="text-amber-400" />}
          label="Score de Esfuerzo"
          value={`${point.effort_score.toFixed(1)} / 100`}
          color="text-amber-400"
        />
      </div>

      {/* Barras visuales de scores */}
      <div className="space-y-3">
        <ScoreBar label="Impacto" value={point.impact_score} color="bg-electric" />
        <ScoreBar label="Esfuerzo" value={point.effort_score} color="bg-amber-400" />
      </div>

      {/* Posición relativa */}
      <div className="bg-navy-800/50 rounded-lg p-3 text-xs space-y-1">
        <p className="text-slate-400 font-medium mb-2">Posición en matriz</p>
        <p className="text-slate-500">
          Impacto: <span className={cn("font-semibold", point.impact_score >= 50 ? "text-emerald-400" : "text-rose-400")}>
            {point.impact_score >= 50 ? "Alto" : "Bajo"}
          </span>
        </p>
        <p className="text-slate-500">
          Esfuerzo: <span className={cn("font-semibold", point.effort_score < 50 ? "text-emerald-400" : "text-amber-400")}>
            {point.effort_score < 50 ? "Bajo (fácil)" : "Alto (difícil)"}
          </span>
        </p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// Panel lateral — Matriz ROI
// ══════════════════════════════════════════════════════════
function ROIProjectPanel({ point, onClose }: { point: ROIPlotPoint; onClose: () => void }) {
  const config       = ROI_QUADRANT_CONFIG[point.cuadrante_roi as ROICuadranteKey]
  const reduccionPct = point.horas_proceso_actual > 0
    ? ((point.horas_ahorradas / point.horas_proceso_actual) * 100)
    : 0

  return (
    <div className="space-y-4">
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

      <div className="space-y-2">
        <MetricRow icon={<TrendingUp size={12} className="text-emerald-400" />}
          label="ROI calculado"        value={`${point.roi_pct.toFixed(1)}%`}          color="text-emerald-400" />
        <MetricRow icon={<Clock size={12} className="text-amber-400" />}
          label="Horas ahorradas"      value={`${fmtNum(point.horas_ahorradas)} h`}     color="text-amber-400" />
        <MetricRow icon={<DollarSign size={12} className="text-cyan-400" />}
          label="Ahorro en COP"        value={fmtCOP(point.roi_valor_total)}             color="text-cyan-400" />
        <MetricRow icon={<Users size={12} className="text-indigo-400" />}
          label="Personas impactadas"  value={`${point.num_personas}`}                  color="text-indigo-400" />
        <MetricRow icon={<Zap size={12} className="text-rose-400" />}
          label="Reducción del proceso" value={`${reduccionPct.toFixed(1)}%`}           color="text-rose-400" />
        <MetricRow icon={<Clock size={12} className="text-slate-400" />}
          label="Proceso actual"        value={`${point.horas_proceso_actual} h`}       color="text-slate-300" />
      </div>

      {/* Barra de progreso */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>Proceso optimizado</span>
          <span>{reduccionPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-navy-700 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-400 transition-all"
            style={{ width: `${Math.min(reduccionPct, 100)}%` }} />
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          {fmtNum(point.horas_ahorradas)} h ahorradas de {point.horas_proceso_actual} h totales
        </p>
      </div>
    </div>
  )
}

// ── Componentes reutilizables ─────────────────────────────────────────────────
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

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
        <span>{label}</span><span>{value.toFixed(0)}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-navy-700 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}
