import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  Lock,
  MessageCircle,
  Target,
  TrendingUp,
  UserRound,
  Users,
  Zap,
} from "lucide-react"
import api from "@/lib/api"
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { canVerROI, isAdmin, isSuperAdmin, isUsuario } from "@/lib/roles"
import { useAuthStore } from "@/store/authStore"
import type { Project } from "@/types/project"
import { ROI_QUADRANT_CONFIG, type ROICuadranteKey, type ROIRead } from "@/types/roi"
import ProjectChat from "@/components/chat/ProjectChat"
import EvaluationWizard from "@/components/evaluation/EvaluationWizard"
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
  pendiente_revision: { label: "Pendiente revisión", class: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  escalado: { label: "Escalado", class: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  preguntas_asignadas: { label: "Preguntas asignadas", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  en_evaluacion: { label: "En evaluación", class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  evaluado: { label: "Evaluado", class: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  pendiente_salario: { label: "Pendiente salario", class: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  calculando_roi: { label: "Calculando ROI", class: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  aprobado_final: { label: "Aprobado", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  rechazado: { label: "Rechazado", class: "bg-red-500/20 text-red-400 border-red-500/30" },
}

const STATUS_CONFIG_USUARIO: Record<string, { label: string; class: string }> = {
  pendiente_revision: { label: "En espera de revisión", class: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  escalado: { label: "En revisión", class: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  preguntas_asignadas: { label: "Aprobado, en cola", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  en_evaluacion: { label: "Siendo evaluado", class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  evaluado: { label: "Evaluado", class: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  pendiente_salario: { label: "Siendo evaluado", class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  calculando_roi: { label: "Siendo evaluado", class: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  aprobado_final: { label: "Aprobado", class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  rechazado: { label: "Rechazado", class: "bg-red-500/20 text-red-400 border-red-500/30" },
}

export default function ProjectDetailShowcasePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [project, setProject] = useState<Project | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [roiData, setRoiData] = useState<ROIRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [evaluating, setEvaluating] = useState(false)

  const esUsuario = isUsuario(user)
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

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-electric/30 border-t-electric" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
        <p className="text-sm">{fetchError}</p>
        <button onClick={() => navigate("/projects")} className="text-sm text-electric hover:underline">
          Volver a proyectos
        </button>
      </div>
    )
  }

  if (!project) return null

  const latestEval = evaluations[0] ?? null
  const latestConfig = latestEval ? QUADRANT_CONFIG[latestEval.quadrant as QuadrantKey] : null
  const roiCalculado = roiData && roiData.roi_pct > 0
  const roiConfig = roiCalculado
    ? ROI_QUADRANT_CONFIG[roiData!.cuadrante_roi as ROICuadranteKey] ?? ROI_QUADRANT_CONFIG.bajo_impacto
    : null

  const statusMap = esUsuario ? STATUS_CONFIG_USUARIO : STATUS_CONFIG
  const statusConf = statusMap[project.status] ?? statusMap.pendiente_revision
  const backPath = esUsuario ? "/mis-proyectos" : "/projects"
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
      <div className="mx-auto max-w-[1700px] px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)]">
          <div className="space-y-8">
            <button
              onClick={() => navigate(backPath)}
              className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a {backLabel}
            </button>

            <motion.section
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[28px] border border-slate-700/60 bg-[radial-gradient(circle_at_top_left,_rgba(49,159,255,0.16),_transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(8,15,30,0.92))] p-6 shadow-[0_20px_80px_rgba(2,8,23,0.45)]"
            >
              <div className="absolute -right-16 top-8 h-40 w-40 rounded-full bg-electric/10 blur-3xl" />
              <div className="absolute left-10 top-20 h-24 w-24 rounded-full border border-electric/10 bg-electric/5 blur-2xl" />

              <div className="relative space-y-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center rounded-full border border-electric/20 bg-electric/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-electric">
                        Expediente del OKR
                      </span>
                      <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium", statusConf.class)}>
                        {statusConf.label}
                      </span>
                    </div>

                    <div>
                      <h1 className="max-w-4xl text-2xl font-bold leading-tight text-white sm:text-3xl">
                        {project.title}
                      </h1>
                      {projectSummary && (
                        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300 sm:text-[15px]">
                          {projectSummary}
                        </p>
                      )}
                    </div>
                  </div>

                  {canEvaluate && project.status === "en_evaluacion" && (
                    <button
                      onClick={() => setEvaluating(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-electric/30 bg-electric/10 px-4 py-3 text-sm font-medium text-electric transition-all hover:bg-electric/20"
                    >
                      <Target className="h-4 w-4" />
                      {latestEval ? "Re-evaluar" : "Evaluar Impacto/Esfuerzo"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <InfoTile
                    icon={<ClipboardList className="h-4 w-4 text-electric" />}
                    label="Origen"
                    value={project.source === "list" ? "Microsoft Lists" : "Manual"}
                  />
                  <InfoTile
                    icon={<Calendar className="h-4 w-4 text-electric" />}
                    label="Fecha de carga"
                    value={new Date(project.created_at).toLocaleDateString("es-CO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  />
                  <InfoTile
                    icon={<UserRound className="h-4 w-4 text-electric" />}
                    label="Subido por"
                    value={project.submitted_by_name ?? `Usuario ${project.owner_id}`}
                  />
                </div>

                {collaborators.length > 0 && (
                  <div className="rounded-2xl border border-slate-700/60 bg-slate-900/45 p-4">
                    <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <Users className="h-3.5 w-3.5 text-electric" />
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

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {detailSections.map((section, index) => (
                    <section
                      key={section.label}
                      className={cn(
                        "relative overflow-hidden rounded-[24px] border border-slate-700/60 bg-slate-900/55 p-5",
                        index === 0 && "lg:col-span-2"
                      )}
                    >
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-electric/35 to-transparent" />
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {section.label}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                        {section.value}
                      </p>
                    </section>
                  ))}
                </div>
              </div>
            </motion.section>

            <section className="space-y-5">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-electric/80">
                  Sección visual
                </p>
                <h2 className="text-xl font-semibold text-white">Matrices y lectura del proyecto</h2>
                <p className="text-sm text-slate-400">
                  Aquí aparece la ubicación visual del proyecto, su interpretación y el análisis ROI cuando aplique.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-slate-700/50 bg-slate-900/45 p-5">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Posición visual en la matriz
                    </p>
                    {latestEval ? (
                      <MatrixMiniPlot
                        impactScore={latestEval.impact_score}
                        effortScore={latestEval.effort_score}
                        quadrant={latestEval.quadrant as QuadrantKey}
                      />
                    ) : (
                      <div className="flex h-56 flex-col items-center justify-center gap-2 text-slate-600">
                        <Target className="h-8 w-8 opacity-20" />
                        <p className="text-sm">Sin posición aún</p>
                      </div>
                    )}
                  </div>

                  {latestEval && latestConfig ? (
                    <div className="rounded-[24px] border border-slate-700/50 bg-slate-900/45 p-5">
                      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Lectura impacto vs esfuerzo
                      </p>
                      <div className={cn("mb-4 flex items-center gap-3 rounded-2xl border p-4", latestConfig.bgClass)}>
                        <latestConfig.Icon className={cn("h-5 w-5 shrink-0", latestConfig.color)} />
                        <div>
                          <p className={cn("text-sm font-semibold", latestConfig.color)}>
                            {latestConfig.label}
                          </p>
                          <p className="text-xs text-slate-400">{latestConfig.description}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <MetricBox
                          icon={<TrendingUp className="h-4 w-4 text-electric" />}
                          label="Impacto"
                          value={`${latestEval.impact_score.toFixed(0)}/100`}
                          barColor="bg-electric"
                          barValue={latestEval.impact_score}
                        />
                        <MetricBox
                          icon={<Zap className="h-4 w-4 text-amber-400" />}
                          label="Esfuerzo"
                          value={`${latestEval.effort_score.toFixed(0)}/100`}
                          barColor="bg-amber-400"
                          barValue={latestEval.effort_score}
                        />
                      </div>
                    </div>
                  ) : (
                    <EmptyPanel
                      title="Lectura impacto vs esfuerzo"
                      icon={<Target className="h-8 w-8 opacity-30" />}
                      message="Aún sin evaluación"
                    />
                  )}
                </div>

                <div className="space-y-5">
                  {canSeeROI ? (
                    roiCalculado && roiConfig ? (
                      <div className="rounded-[24px] border border-slate-700/50 bg-slate-900/45 p-5">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Análisis ROI
                        </p>
                        <div className={cn("mb-4 rounded-2xl border p-4", roiConfig.bgClass, roiConfig.borderClass)}>
                          <p className={cn("text-sm font-semibold", roiConfig.color)}>
                            {roiConfig.label}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <MetricBox
                            icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
                            label="ROI"
                            value={`${roiData!.roi_pct.toFixed(1)}%`}
                            barColor="bg-emerald-400"
                            barValue={Math.min(roiData!.roi_pct, 100)}
                          />
                          <MetricBox
                            icon={<Zap className="h-4 w-4 text-amber-400" />}
                            label="Horas ahorradas"
                            value={`${roiData!.horas_ahorradas.toFixed(1)}h`}
                            barColor="bg-amber-400"
                            barValue={Math.min((roiData!.horas_ahorradas / 10) * 100, 100)}
                          />
                          <InfoTile
                            icon={<ClipboardList className="h-4 w-4 text-slate-300" />}
                            label="Proceso actual"
                            value={`${roiData!.horas_proceso_actual.toFixed(1)}h`}
                          />
                          <InfoTile
                            icon={<ClipboardList className="h-4 w-4 text-slate-300" />}
                            label="Proceso nuevo"
                            value={`${(roiData!.horas_proyectadas ?? 0).toFixed(1)}h`}
                          />
                        </div>
                      </div>
                    ) : (
                      <EmptyPanel
                        title="Análisis ROI"
                        icon={<TrendingUp className="h-8 w-8 opacity-30" />}
                        message="ROI aún no calculado"
                        helper={roiData && roiData.roi_pct === 0 ? "Salario registrado · pendiente datos operacionales" : undefined}
                      />
                    )
                  ) : (
                    <EmptyPanel
                      title="Análisis ROI"
                      icon={<Lock className="h-8 w-8 opacity-30" />}
                      message="El análisis ROI no está disponible para tu rol"
                    />
                  )}
                </div>
              </div>
            </section>
          </div>

          <aside className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
            <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-[24px] border border-slate-700/60 bg-slate-900/65 shadow-[0_18px_60px_rgba(2,8,23,0.4)]">
              <div className="flex items-center gap-2 border-b border-slate-700/50 px-5 py-4">
                <MessageCircle className="h-4 w-4 text-electric" />
                <div>
                  <p className="text-sm font-medium text-slate-200">Canal de comunicación</p>
                  <p className="text-xs text-slate-500">Permanece visible mientras recorres el detalle</p>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <ProjectChat projectId={project.id} />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {evaluating && (
        <EvaluationWizard
          projectId={project.id}
          projectName={project.title}
          onClose={() => {
            setEvaluating(false)
            fetchData()
          }}
        />
      )}
    </>
  )
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/45 p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm text-slate-200">{value}</p>
    </div>
  )
}

function EmptyPanel({
  title,
  icon,
  message,
  helper,
}: {
  title: string
  icon: React.ReactNode
  message: string
  helper?: string
}) {
  return (
    <div className="rounded-[24px] border border-slate-700/50 bg-slate-900/45 p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </p>
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-600">
        {icon}
        <p className="text-center text-sm">{message}</p>
        {helper && <p className="max-w-xs text-center text-xs text-slate-500">{helper}</p>}
      </div>
    </div>
  )
}

function MetricBox({
  icon,
  label,
  value,
  barColor,
  barValue,
}: {
  icon: React.ReactNode
  label: string
  value: string
  barColor: string
  barValue: number
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-sm font-bold text-white">{value}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.max(0, Math.min(barValue, 100))}%` }}
        />
      </div>
    </div>
  )
}
