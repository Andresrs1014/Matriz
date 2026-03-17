// frontend/src/pages/ProjectDetailPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"   // ← AnimatePresence añadido
import {
  ArrowLeft, Calendar, ClipboardList, Target, Zap,
  TrendingUp, MessageCircle,
} from "lucide-react"
import api from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { isAdmin, isSuperAdmin, canVerROI } from "@/lib/roles"
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
import { ROI_QUADRANT_CONFIG, type ROICuadranteKey } from "@/types/roi"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"
import type { ROIRead } from "@/types/roi"
import EvaluationWizard from "@/components/evaluation/EvaluationWizard"
import ProjectChat from "@/components/chat/ProjectChat"

interface Evaluation {
  id: number
  impact_score: number
  effort_score: number
  quadrant: string
  notes: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pendiente_revision:  { label: "Pendiente revisión",  class: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  escalado:            { label: "Escalado",             class: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  preguntas_asignadas: { label: "Preguntas asignadas",  class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  en_evaluacion:       { label: "En evaluación",        class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  evaluado:            { label: "Evaluado",             class: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  pendiente_salario:   { label: "Pendiente salario",    class: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  calculando_roi:      { label: "Calculando ROI",       class: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  aprobado_final:      { label: "✓ Aprobado",           class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  rechazado:           { label: "Rechazado",            class: "bg-red-500/20 text-red-400 border-red-500/30" },
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [project, setProject] = useState<Project | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [roiData, setRoiData] = useState<ROIRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const canSeeROI = canVerROI(user)
  const canEvaluate = isAdmin(user) || isSuperAdmin(user)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setFetchError(null)
    try {
      const [projRes, evalRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/matrix/history/${id}`).catch(() => ({ data: [] as Evaluation[] })),
      ])
      setProject(projRes.data)
      setEvaluations(evalRes.data)
      if (canSeeROI) {
        const roiRes = await api.get(`/roi/${id}`).catch(() => ({ data: null }))
        setRoiData(roiRes.data)
      }
    } catch {
      setFetchError("No se pudo cargar el proyecto.")
    } finally {
      setLoading(false)
    }
  }, [id, canSeeROI])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-electric/30 border-t-electric rounded-full animate-spin" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-sm text-red-400">{fetchError}</p>
        <button
          onClick={() => navigate("/projects")}
          className="text-sm text-electric hover:underline"
        >
          Volver a proyectos
        </button>
      </div>
    )
  }

  if (!project) return null

  const latestEval   = evaluations[0] ?? null
  const latestConfig = latestEval ? QUADRANT_CONFIG[latestEval.quadrant as QuadrantKey] : null
  const roiConfig    = roiData ? ROI_QUADRANT_CONFIG[roiData.cuadrante_roi as ROICuadranteKey] ?? ROI_QUADRANT_CONFIG.bajo_impacto : null
  const statusConf   = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.pendiente_revision

  // El botón evaluar solo aparece cuando el proyecto está en_evaluacion

  return (
    <>
      {/* Contenido principal — sin EvaluationWizard adentro */}
      <div className="p-6 mx-auto w-full max-w-[1126px] animate-fade-in flex flex-col gap-6">

        {/* Breadcrumb */}
        <button
          onClick={() => navigate("/projects")}
          className="self-start flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Volver a Proyectos
        </button>

        {/* Header */}
        <div className="glass-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h2 className="text-xl font-bold text-white">{project.title}</h2>
                <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", statusConf.class)}>
                  {statusConf.label}
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
              </div>
            </div>

            {/* ← CORREGIDO: solo visible cuando status === "en_evaluacion" */}
            {canEvaluate && project.status === "en_evaluacion" && (
              <button
                onClick={() => setEvaluating(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm font-medium hover:bg-electric/20 transition-all whitespace-nowrap"
              >
                <Target size={15} />
                {latestEval ? "Re-evaluar" : "Evaluar Impacto/Esfuerzo"}
              </button>
            )}
          </div>
        </div>

        {/* Resultado en la Matriz */}
        {latestEval && latestConfig && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("glass-card p-6 border", latestConfig.bgClass)}
          >
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-5">Posición actual en la Matriz</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className={cn("px-5 py-4 rounded-xl border w-fit shrink-0", latestConfig.bgClass, latestConfig.glowClass)}>
                <p className={cn("text-2xl font-bold", latestConfig.textClass)}>{latestConfig.label}</p>
                <p className="text-xs text-slate-400 mt-1">{latestConfig.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div className="bg-navy-800/60 rounded-xl p-4 border border-navy-700">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp size={13} className="text-cyan-400" />
                    <span className="text-xs text-slate-400">Impacto</span>
                  </div>
                  <p className="text-2xl font-bold text-cyan-400">
                    {latestEval.impact_score.toFixed(0)}
                    <span className="text-sm text-slate-500">/100</span>
                  </p>
                </div>
                <div className="bg-navy-800/60 rounded-xl p-4 border border-navy-700">
                  <div className="flex items-center gap-1.5 mb-2">
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

        {/* ROI */}
        {canSeeROI && roiData && roiData.horas_proceso_actual > 0 && roiConfig && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("glass-card p-6 border", roiConfig.bgClass, roiConfig.borderClass)}
          >
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-5">Análisis de ROI</p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className={cn("px-5 py-4 rounded-xl border w-fit shrink-0", roiConfig.bgClass, roiConfig.borderClass)}>
                <p className={cn("text-2xl font-bold", roiConfig.textClass)}>{roiConfig.label}</p>
                <p className="text-xs text-slate-400 mt-1">{roiConfig.action}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
                <div className="bg-navy-800/60 rounded-xl p-4 border border-navy-700">
                  <p className="text-xs text-slate-400 mb-2">ROI</p>
                  <p className={cn("text-xl font-bold", roiConfig.textClass)}>{roiData.roi_pct.toFixed(1)}%</p>
                </div>
                <div className="bg-navy-800/60 rounded-xl p-4 border border-navy-700">
                  <p className="text-xs text-slate-400 mb-2">Horas antes</p>
                  <p className="text-xl font-bold text-white">{roiData.horas_proceso_actual.toFixed(1)}<span className="text-sm text-slate-500"> h</span></p>
                </div>
                <div className="bg-navy-800/60 rounded-xl p-4 border border-navy-700">
                  <p className="text-xs text-slate-400 mb-2">Horas nuevas</p>
                  <p className="text-xl font-bold text-blue-400">
                    {(roiData.horas_proyectadas ?? (roiData.horas_proceso_actual - roiData.horas_ahorradas)).toFixed(1)}
                    <span className="text-sm text-slate-500"> h</span>
                  </p>
                </div>
                <div className="bg-navy-800/60 rounded-xl p-4 border border-navy-700">
                  <p className="text-xs text-slate-400 mb-2">Horas ahorradas</p>
                  <p className="text-xl font-bold text-emerald-400">{roiData.horas_ahorradas.toFixed(1)}<span className="text-sm text-slate-500"> h</span></p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Chat */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-700/50">
            <MessageCircle className="w-4 h-4 text-electric" />
            <span className="text-sm font-medium text-slate-200">Canal de comunicación</span>
          </div>
          <div className="h-[500px]">
            <ProjectChat projectId={project.id} />
          </div>
        </div>

      </div>

      {/* ← CORREGIDO: EvaluationWizard FUERA del div animado con AnimatePresence */}
      <AnimatePresence>
        {evaluating && (
          <EvaluationWizard
            projectId={project.id}
            projectName={project.title}
            onClose={() => { setEvaluating(false); fetchData() }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
