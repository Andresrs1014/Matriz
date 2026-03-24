// frontend/src/pages/ProjectDetailPage.tsx
import { useCallback, useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft, Calendar, ClipboardList, Target, Zap,
  TrendingUp, MessageCircle, Lock, UserRound, Users,
} from "lucide-react"
import api from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { isAdmin, isSuperAdmin, canVerROI, isUsuario } from "@/lib/roles"
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
import { ROI_QUADRANT_CONFIG, type ROICuadranteKey } from "@/types/roi"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"
import type { ROIRead } from "@/types/roi"
import EvaluationWizard from "@/components/evaluation/EvaluationWizard"
import ProjectChat from "@/components/chat/ProjectChat"
import MatrixMiniPlot from "@/components/matrix/MatrixMiniPlot"

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
  escalado:            { label: "Escalado",            class: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  preguntas_asignadas: { label: "Preguntas asignadas", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  en_evaluacion:       { label: "En evaluación",       class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  evaluado:            { label: "Evaluado",            class: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  pendiente_salario:   { label: "Pendiente salario",   class: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  calculando_roi:      { label: "Calculando ROI",      class: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  aprobado_final:      { label: "✓ Aprobado",          class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  rechazado:           { label: "Rechazado",           class: "bg-red-500/20 text-red-400 border-red-500/30" },
}

// Estados amigables para el usuario normal
const STATUS_CONFIG_USUARIO: Record<string, { label: string; class: string }> = {
  pendiente_revision:  { label: "En espera de revisión", class: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  escalado:            { label: "En revisión",           class: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  preguntas_asignadas: { label: "Aprobado, en cola",     class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  en_evaluacion:       { label: "Siendo evaluado",       class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  evaluado:            { label: "Evaluado",              class: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  pendiente_salario:   { label: "Siendo evaluado",       class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  calculando_roi:      { label: "Siendo evaluado",       class: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  aprobado_final:      { label: "✓ Aprobado",            class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  rechazado:           { label: "Rechazado",             class: "bg-red-500/20 text-red-400 border-red-500/30" },
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [project, setProject]       = useState<Project | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [roiData, setRoiData]       = useState<ROIRead | null>(null)
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)

  const esUsuario   = isUsuario(user)
  const canSeeROI   = canVerROI(user)
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
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <p className="text-sm">{fetchError}</p>
        <button onClick={() => navigate("/projects")}
          className="text-sm text-electric hover:underline">
          Volver a proyectos
        </button>
      </div>
    )
  }

  if (!project) return null

  const latestEval   = evaluations[0] ?? null
  const latestConfig = latestEval ? QUADRANT_CONFIG[latestEval.quadrant as QuadrantKey] : null

  // ROI solo se muestra cuando roi_pct > 0 (parte2 completada)
  const roiCalculado = roiData && roiData.roi_pct > 0
  const roiConfig    = roiCalculado
    ? ROI_QUADRANT_CONFIG[roiData!.cuadrante_roi as ROICuadranteKey] ?? ROI_QUADRANT_CONFIG.bajo_impacto
    : null

  // Usar labels amigables para usuario normal
  const statusMap  = esUsuario ? STATUS_CONFIG_USUARIO : STATUS_CONFIG
  const statusConf = statusMap[project.status] ?? statusMap.pendiente_revision

  // Breadcrumb dinámico por rol
  const backPath  = esUsuario ? "/mis-proyectos" : "/projects"
  const backLabel = esUsuario ? "Mis proyectos" : "Proyectos"
  const projectSummary = project.okr_objectives ?? project.description
  const detailSections = [
    { label: "Objetivos del OKR", value: project.okr_objectives ?? project.description },
    { label: "Resultados clave", value: project.key_results },
    { label: "Acciones clave", value: project.key_actions },
    { label: "Recursos", value: project.resources },
    { label: "Los 5 porqué", value: project.five_whys },
    { label: "Métodos de medición", value: project.measurement_methods },
  ].filter((section) => Boolean(section.value))
  const collaborators = project.collaborators ?? []

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <button onClick={() => navigate(backPath)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver a {backLabel}
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-white">{project.title}</h1>
              <span className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-full border",
                statusConf.class
              )}>
                {statusConf.label}
              </span>
            </div>
            {projectSummary && (
              <p className="text-sm text-slate-400 mt-1.5">{projectSummary}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ClipboardList className="w-3.5 h-3.5" />
                {project.source === "list" ? "Microsoft Lists" : "Manual"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(project.created_at).toLocaleDateString("es-CO")}
              </span>
              <span className="flex items-center gap-1">
                <UserRound className="w-3.5 h-3.5" />
                {project.submitted_by_name ?? `Usuario ${project.owner_id}`}
              </span>
            </div>
          </div>

          {/* Botón evaluar — solo admin cuando proyecto está en_evaluacion */}
          {canEvaluate && project.status === "en_evaluacion" && (
            <button onClick={() => setEvaluating(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm font-medium hover:bg-electric/20 transition-all whitespace-nowrap shrink-0">
              <Target className="w-4 h-4" />
              {latestEval ? "Re-evaluar" : "Evaluar Impacto/Esfuerzo"}
            </button>
          )}
        </motion.div>

        {/* Layout dos columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Columna izquierda ────────────────────────────── */}
          <div className="space-y-5">

            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 space-y-5">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Ficha del OKR
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-800/60 rounded-lg p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Fecha de carga</p>
                    <p className="text-sm text-slate-200">
                      {new Date(project.created_at).toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Subido por</p>
                    <p className="text-sm text-slate-200">
                      {project.submitted_by_name ?? `Usuario ${project.owner_id}`}
                    </p>
                  </div>
                </div>
              </div>

              {collaborators.length > 0 && (
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                    <Users className="w-3.5 h-3.5" />
                    Personas que colaboraron
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {collaborators.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center rounded-full border border-electric/20 bg-electric/10 px-3 py-1 text-xs text-electric"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {detailSections.map((section) => (
                  <div key={section.label} className="bg-slate-800/60 rounded-lg p-4">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">{section.label}</p>
                    <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{section.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Posición en la Matriz */}
            {latestEval && latestConfig ? (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
                  Posición en la Matriz
                </p>
                <div className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border mb-4",
                  latestConfig.bgClass
                )}>
                  <latestConfig.Icon className={cn("w-5 h-5 shrink-0", latestConfig.color)} />
                  <div>
                    <p className={cn("text-sm font-semibold", latestConfig.color)}>
                      {latestConfig.label}
                    </p>
                    <p className="text-xs text-slate-400">{latestConfig.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetricBox
                    icon={<TrendingUp className="w-4 h-4 text-electric" />}
                    label="Impacto"
                    value={`${latestEval.impact_score.toFixed(0)}/100`}
                    barColor="bg-electric"
                    barValue={latestEval.impact_score}
                  />
                  <MetricBox
                    icon={<Zap className="w-4 h-4 text-amber-400" />}
                    label="Esfuerzo"
                    value={`${latestEval.effort_score.toFixed(0)}/100`}
                    barColor="bg-amber-400"
                    barValue={latestEval.effort_score}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Posición en la Matriz
                </p>
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-600">
                  <Target className="w-8 h-8 opacity-30" />
                  <p className="text-sm">Aún sin evaluación</p>
                </div>
              </div>
            )}

            {/* ROI */}
            {canSeeROI ? (
              roiCalculado && roiConfig ? (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
                    Análisis ROI
                  </p>
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border mb-4",
                    roiConfig.bgClass, roiConfig.borderClass
                  )}>
                    <p className={cn("text-sm font-semibold", roiConfig.color)}>
                      {roiConfig.label}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-800/60 rounded-lg p-3">
                      <p className="text-slate-500">ROI</p>
                      <p className="text-emerald-400 font-bold text-base mt-0.5">
                        {roiData!.roi_pct.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3">
                      <p className="text-slate-500">Horas ahorradas</p>
                      <p className="text-amber-400 font-bold text-base mt-0.5">
                        {roiData!.horas_ahorradas.toFixed(1)}h
                      </p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3">
                      <p className="text-slate-500">Proceso actual</p>
                      <p className="text-slate-200 font-semibold mt-0.5">
                        {roiData!.horas_proceso_actual.toFixed(1)}h
                      </p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3">
                      <p className="text-slate-500">Proceso nuevo</p>
                      <p className="text-slate-200 font-semibold mt-0.5">
                        {(roiData!.horas_proyectadas ?? 0).toFixed(1)}h
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                    Análisis ROI
                  </p>
                  <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-600">
                    <TrendingUp className="w-8 h-8 opacity-30" />
                    <p className="text-sm">ROI aún no calculado</p>
                    {roiData && roiData.roi_pct === 0 && (
                      <p className="text-xs text-slate-700 text-center px-4">
                        Salario registrado · pendiente datos operacionales
                      </p>
                    )}
                  </div>
                </div>
              )
            ) : (
              /* Usuario normal — ROI bloqueado */
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Análisis ROI
                </p>
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-600">
                  <Lock className="w-8 h-8 opacity-30" />
                  <p className="text-sm text-center">
                    El análisis ROI no está disponible para tu rol
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Columna derecha — Mini plot + Chat ───────────── */}
          <div className="space-y-5">

            {/* Mini scatter plot */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
                Posición visual en la Matriz
              </p>
              {latestEval ? (
                <MatrixMiniPlot
                  impactScore={latestEval.impact_score}
                  effortScore={latestEval.effort_score}
                  quadrant={latestEval.quadrant as QuadrantKey}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-600">
                  <Target className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Sin posición aún</p>
                </div>
              )}
            </div>

            {/* Chat */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-700/50">
                <MessageCircle className="w-4 h-4 text-electric" />
                <span className="text-sm font-medium text-slate-200">
                  Canal de comunicación
                </span>
              </div>
              <div className="h-80">
                <ProjectChat projectId={project.id}/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wizard evaluación — fuera del layout para no romper el z-index */}
      {evaluating && (
        <EvaluationWizard
          projectId={project.id}
          projectName={project.title}
          onClose={() => { setEvaluating(false); fetchData() }}
        />
      )}
    </>
  )
}

// ── Componente local ───────────────────────────────────────────────────────────
function MetricBox({
  icon, label, value, barColor, barValue,
}: {
  icon: React.ReactNode
  label: string
  value: string
  barColor: string
  barValue: number
}) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-sm font-bold text-white">{value}</p>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${barValue}%` }} />
      </div>
    </div>
  )
}
