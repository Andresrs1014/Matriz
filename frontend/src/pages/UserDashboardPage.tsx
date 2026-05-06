// frontend/src/pages/UserDashboardPage.tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, FileText, Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight } from "lucide-react"
import api from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import ProjectSubmitForm from "@/components/projects/ProjectSubmitForm"

interface Project {
  id: number
  title: string
  description: string | null
  status: string
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; class: string; bg: string }> = {
  pendiente_revision: { label: "Pendiente revisión", icon: Clock,        class: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  aprobado:           { label: "Aprobado",           icon: CheckCircle2, class: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  en_evaluacion:      { label: "En evaluación",      icon: AlertCircle,  class: "text-electric",    bg: "bg-electric/10 border-electric/20" },
  evaluado:           { label: "Evaluado",           icon: CheckCircle2, class: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
  aprobado_final:     { label: "Aprobación final",   icon: CheckCircle2, class: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20" },
  rechazado:          { label: "Rechazado",          icon: XCircle,      class: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
}

const FLOW_STEPS = [
  "pendiente_revision",
  "aprobado",
  "en_evaluacion",
  "evaluado",
  "aprobado_final",
]

export default function UserDashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function fetchProjects() {
    try {
      const res = await api.get("/projects/mine")
      setProjects(res.data)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const mainProject = projects[0] ?? null
  const statusConf = mainProject ? (STATUS_CONFIG[mainProject.status] ?? STATUS_CONFIG.pendiente_revision) : null
  const currentStep = mainProject ? FLOW_STEPS.indexOf(mainProject.status) : -1

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      {/* Saludo */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-white">
          Hola, <span className="text-electric">{user?.full_name ?? user?.email}</span> 👋
        </h1>
        <p className="text-slate-400 mt-1">Aquí puedes ver el estado de tu proyecto y comunicarte con el equipo.</p>
      </motion.div>

      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="w-8 h-8 border-2 border-electric/30 border-t-electric rounded-full animate-spin" />
        </div>
      ) : mainProject ? (
        <>
          {/* Proyecto principal */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wide">Tu proyecto</span>
                </div>
                <h2 className="text-lg font-semibold text-white">{mainProject.title}</h2>
                {mainProject.description && (
                  <p className="text-sm text-slate-400 mt-1 line-clamp-2">{mainProject.description}</p>
                )}
              </div>
              {statusConf && (
                <span className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium shrink-0", statusConf.bg, statusConf.class)}>
                  <statusConf.icon className="w-3.5 h-3.5" />
                  {statusConf.label}
                </span>
              )}
            </div>

            {/* Barra de progreso del flujo */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Progreso del flujo</p>
              <div className="flex items-center gap-1">
                {FLOW_STEPS.map((step, i) => {
                  const done = i <= currentStep
                  return (
                    <div key={step} className="flex items-center gap-1 flex-1">
                      <div className={cn(
                        "h-2 flex-1 rounded-full transition-all",
                        done ? "bg-electric" : "bg-slate-700"
                      )} />
                      {i < FLOW_STEPS.length - 1 && (
                        <div className={cn("w-2 h-2 rounded-full shrink-0", done ? "bg-electric" : "bg-slate-700")} />
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Pendiente</span>
                <span>Aprobación final</span>
              </div>
            </div>

            <button
              onClick={() => navigate(`/projects/${mainProject.id}`)}
              className="flex items-center gap-2 w-full justify-center py-2 rounded-lg border border-electric/30 text-electric text-sm hover:bg-electric/10 transition-all"
            >
              Ver detalle y comentarios <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>

          {/* Otros proyectos si tiene más */}
          {projects.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-400 font-medium">Otros proyectos</p>
              {projects.slice(1).map((p) => {
                const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pendiente_revision
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/40 hover:border-slate-600/50 cursor-pointer transition-all"
                  >
                    <span className="text-sm text-slate-300">{p.title}</span>
                    <span className={cn("text-xs font-medium", sc.class)}>{sc.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : (
        /* Sin proyecto */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500"
        >
          <FileText className="w-12 h-12 opacity-20" />
          <p className="text-sm">Aún no tienes proyectos registrados</p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm hover:bg-electric/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Subir mi proyecto
          </button>
        </motion.div>
      )}

      {/* Botón flotante para agregar si ya tiene proyectos */}
      {mainProject && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 text-sm hover:text-white hover:border-slate-600 transition-all"
        >
          <Plus className="w-4 h-4" /> Subir otro proyecto
        </button>
      )}

      {/* Modal formulario */}
      {showForm && (
        <ProjectSubmitForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchProjects() }}
        />
      )}
    </div>
  )
}
