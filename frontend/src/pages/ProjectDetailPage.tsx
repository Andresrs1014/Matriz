import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Calendar, ClipboardList,
  TrendingUp, Zap, Target, Clock, RotateCcw, DollarSign
} from "lucide-react"
import api from "@/lib/api"
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
import { ROI_QUADRANT_CONFIG, type ROICuadranteKey } from "@/types/roi"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"
import type { ROIRead } from "@/types/roi"
import EvaluationWizard from "@/components/evaluation/EvaluationWizard"
import ROIWizard        from "@/components/roi/ROIWizard"

interface Evaluation {
  id:           number
  impact_score: number
  effort_score: number
  quadrant:     string
  notes:        string | null
  created_at:   string
}

const STATUS_CONFIG = {
  nuevo:       { label: "Nuevo",        class: "bg-slate-500/20 text-slate-300 border-slate-500/30"      },
  en_progreso: { label: "En progreso",  class: "bg-electric/20 text-electric border-electric/30"         },
  completado:  { label: "Completado",   class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"},
  cancelado:   { label: "Cancelado",    class: "bg-red-500/20 text-red-400 border-red-500/30"            },
}

export default function ProjectDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [project,     setProject]     = useState<Project | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading,     setLoading]     = useState(true)
  const [evaluating,  setEvaluating]  = useState(false)
  const [roiData,     setRoiData]     = useState<ROIRead | null>(null)
  const [roiOpen,     setRoiOpen]     = useState(false)

  async function fetchData() {
    if (!id) return
    setLoading(true)
    try {
      const [projRes, evalRes, roiRes] = await Promise.all([
        api.get<Project>(`/projects/${id}`),
        api.get<Evaluation[]>(`/matrix/history/${id}`),
        api.get<ROIRead>(`/roi/${id}`).catch(() => ({ data: null })),
      ])
      setProject(projRes.data)
      setEvaluations(evalRes.data)
      setRoiData(roiRes.data)
    } catch {
      navigate("/projects")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-electric rounded-full animate-spin border-t-transparent" />
      </div>
    )
  }

  if (!project) return null

  const latestEval  = evaluations[0] ?? null
  const latestConfig = latestEval
    ? QUADRANT_CONFIG[latestEval.quadrant as QuadrantKey]
    : null

  const roiConfig = roiData
    ? ROI_QUADRANT_CONFIG[roiData.cuadrante_roi as ROICuadranteKey]
    : null

  const statusConfig = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG]
    ?? STATUS_CONFIG.nuevo

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">

      {/* Breadcrumb */}
      <button
        onClick={() => navigate("/projects")}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={16} /> Volver a Proyectos
      </button>

      {/* Header del proyecto */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h2 className="text-xl font-bold text-white">{project.title}</h2>
              <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", statusConfig.class)}>
                {statusConfig.label}
              </span>
            </div>
            {project.description && (
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{project.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ClipboardList size={12} />
                {project.source === "list" ? "Microsoft Lists" : "Manual"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(project.created_at).toLocaleDateString("es-CO")}
              </span>
              <span className="flex items-center gap-1">
                <RotateCcw size={12} />
                {evaluations.length} evaluación{evaluations.length !== 1 ? "es" : ""}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setEvaluating(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm font-medium hover:bg-electric/20 transition-all whitespace-nowrap"
            >
              <Target size={15} />
              {latestEval ? "Re-evaluar" : "Evaluar"}
            </button>
            <button
              onClick={() => setRoiOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all whitespace-nowrap"
            >
              <DollarSign size={15} />
              {roiData ? "Re-evaluar ROI" : "Evaluar ROI"}
            </button>
          </div>
        </div>
      </div>

      {/* Resultado actual */}
      {latestEval && latestConfig && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("glass-card p-5 border", latestConfig.bgClass)}
        >
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Posición actual en la Matriz</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={cn("px-5 py-3 rounded-xl border w-fit", latestConfig.bgClass, latestConfig.glowClass)}>
              <p className={cn("text-2xl font-bold", latestConfig.textClass)}>{latestConfig.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{latestConfig.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-1">
              <div className="bg-navy-800/60 rounded-xl p-3 border border-navy-700">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={13} className="text-cyan-400" />
                  <span className="text-xs text-slate-400">Impacto</span>
                </div>
                <p className="text-2xl font-bold text-cyan-400">
                  {latestEval.impact_score.toFixed(0)}
                  <span className="text-sm text-slate-500">/100</span>
                </p>
              </div>
              <div className="bg-navy-800/60 rounded-xl p-3 border border-navy-700">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap size={13} className="text-indigo-400" />
                  <span className="text-xs text-slate-400">Esfuerzo</span>
                </div>
                <p className="text-2xl font-bold text-indigo-400">
                  {latestEval.effort_score.toFixed(0)}
                  <span className="text-sm text-slate-500">/100</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ROI actual */}
      {roiData && roiConfig && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("glass-card p-5 border", roiConfig.bgClass, roiConfig.borderClass)}
        >
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Análisis de ROI</p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={cn("px-5 py-3 rounded-xl border w-fit", roiConfig.bgClass, roiConfig.borderClass)}>
              <p className={cn("text-2xl font-bold", roiConfig.textClass)}>{roiConfig.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{roiConfig.action}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
              <div className="bg-navy-800/60 rounded-xl p-3 border border-navy-700">
                <p className="text-xs text-slate-400 mb-1">ROI</p>
                <p className={cn("text-xl font-bold", roiConfig.textClass)}>{roiData.roi_pct.toFixed(1)}%</p>
              </div>
              <div className="bg-navy-800/60 rounded-xl p-3 border border-navy-700">
                <p className="text-xs text-slate-400 mb-1">Payback</p>
                <p className="text-xl font-bold text-white">{roiData.payback_semanas.toFixed(0)}<span className="text-sm text-slate-500"> sem</span></p>
              </div>
              <div className="bg-navy-800/60 rounded-xl p-3 border border-navy-700">
                <p className="text-xs text-slate-400 mb-1">Ahorro anual</p>
                <p className="text-lg font-bold text-emerald-400">${roiData.ahorro_anual.toLocaleString("es-CO")}</p>
              </div>
              <div className="bg-navy-800/60 rounded-xl p-3 border border-navy-700">
                <p className="text-xs text-slate-400 mb-1">Horas liberadas</p>
                <p className="text-xl font-bold text-blue-400">{roiData.horas_liberadas_anio.toFixed(0)}<span className="text-sm text-slate-500">/año</span></p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Historial de evaluaciones */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Clock size={15} className="text-electric" />
          <p className="text-sm font-semibold text-white">Historial de evaluaciones</p>
        </div>

        {evaluations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Target size={32} className="text-navy-700 mb-2" />
            <p className="text-slate-400 text-sm">Aún no hay evaluaciones</p>
            <p className="text-slate-600 text-xs mt-1">Usa el botón "Evaluar" para comenzar</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {evaluations.map((ev, i) => {
                const config = QUADRANT_CONFIG[ev.quadrant as QuadrantKey]
                const isLatest = i === 0
                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border transition-all",
                      isLatest
                        ? cn("border", config.bgClass, config.glowClass)
                        : "bg-navy-800/40 border-navy-700"
                    )}
                  >
                    {/* Número */}
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                      isLatest ? cn(config.bgClass, config.textClass) : "bg-navy-700 text-slate-400"
                    )}>
                      {evaluations.length - i}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-sm font-semibold", isLatest ? config.textClass : "text-white")}>
                          {config.label}
                        </span>
                        {isLatest && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-electric/20 text-electric border border-electric/30">
                            Actual
                          </span>
                        )}
                      </div>
                      {ev.notes && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{ev.notes}</p>
                      )}
                    </div>

                    {/* Scores */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">
                        I: <span className="text-cyan-400 font-medium">{ev.impact_score.toFixed(0)}</span>
                        {" · "}
                        E: <span className="text-indigo-400 font-medium">{ev.effort_score.toFixed(0)}</span>
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {new Date(ev.created_at).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Wizard de evaluación */}
      <AnimatePresence>
        {evaluating && (
          <EvaluationWizard
            projectId={project.id}
            projectName={project.title}
            onClose={() => { setEvaluating(false); fetchData() }}
          />
        )}
      </AnimatePresence>

      {/* Wizard ROI */}
      <AnimatePresence>
        {roiOpen && (
          <ROIWizard
            projectId={project.id}
            projectName={project.title}
            onClose={() => { setRoiOpen(false); fetchData() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
