import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus, Search, FolderKanban, Trash2, ClipboardList,
  Calendar, Target, DollarSign, X, ChevronRight
} from "lucide-react"
import { useProjects } from "@/hooks/useProjects"
import { useAuthStore } from "@/store/authStore"
import { isAdmin, isCoordinador } from "@/lib/roles"
import EvaluationWizard from "@/components/evaluation/EvaluationWizard"
import ROIWizard from "@/components/roi/ROIWizard"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"

// Estados del flujo real
const STATUS_CONFIG: Record<string, { label: string; class: string; step: number }> = {
  pendiente_revision: {
    label: "Pendiente revisión",
    class: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    step: 1,
  },
  escalado: {
    label: "Escalado",
    class: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    step: 2,
  },
  aprobado: {
    label: "Aprobado",
    class: "bg-electric/20 text-electric border-electric/30",
    step: 3,
  },
  en_evaluacion: {
    label: "En evaluación",
    class: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    step: 4,
  },
  evaluado: {
    label: "Evaluado",
    class: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    step: 5,
  },
  aprobado_final: {
    label: "Aprobado final",
    class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    step: 6,
  },
}

const FLOW_STEPS = [
  "Pendiente revisión",
  "Escalado",
  "Aprobado",
  "En evaluación",
  "Evaluado",
  "Aprobado final",
]


type EvalMode = "operacional" | "roi" | null

export default function ProjectsPage() {
  const { projects, loading, createProject, deleteProject } = useProjects()
  const { user } = useAuthStore()
  const navigate  = useNavigate()

  const [search,      setSearch]      = useState("")
  const [showCreate,  setShowCreate]  = useState(false)
  const [evalTarget,  setEvalTarget]  = useState<Project | null>(null)
  const [evalMode,    setEvalMode]    = useState<EvalMode>(null)
  const [title,       setTitle]       = useState("")
  const [description, setDescription] = useState("")
  const [creating,    setCreating]    = useState(false)

  const canEval   = isAdmin(user) || isCoordinador(user)
  const canDelete = isAdmin(user)

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    await createProject({ title: title.trim(), description: description.trim() || undefined })
    setTitle("")
    setDescription("")
    setShowCreate(false)
    setCreating(false)
  }

  function handleEvaluar(project: Project) {
    setEvalTarget(project)
    setEvalMode(null)
  }

  function handleCloseWizard() {
    setEvalTarget(null)
    setEvalMode(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyectos..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-navy-800 border border-navy-600 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all"
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-electric text-white text-sm font-medium hover:bg-electric-bright shadow-glow-blue transition-all whitespace-nowrap"
        >
          <Plus size={16} /> Nuevo proyecto
        </button>
      </div>

      {/* Modal crear proyecto */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              className="glass-card p-6 w-full max-w-md"
            >
              <h2 className="text-white font-semibold mb-1">Nuevo Proyecto</h2>
              <p className="text-xs text-slate-400 mb-5">Los proyectos también pueden llegar desde Microsoft Lists.</p>
              <div className="laser-line-h mb-5 opacity-40" />
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Nombre del proyecto *</label>
                  <input
                    value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Automatización de despachos" required
                    className="w-full px-4 py-2.5 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Descripción</label>
                  <textarea
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe brevemente el objetivo del proyecto..." rows={3}
                    className="w-full px-4 py-2.5 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 rounded-lg border border-navy-600 text-slate-400 text-sm hover:text-white transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={creating || !title.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-electric text-white text-sm font-medium hover:bg-electric-bright shadow-glow-blue disabled:opacity-40 transition-all">
                    {creating ? "Creando..." : "Crear proyecto"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal selección evaluación — solo admin/coordinador */}
      <AnimatePresence>
        {evalTarget && evalMode === null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="glass-card p-6 w-full max-w-sm"
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="text-white font-semibold text-sm">Evaluar proyecto</h2>
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">{evalTarget.title}</p>
                </div>
                <button onClick={handleCloseWizard} className="text-slate-500 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="laser-line-h my-4 opacity-30" />
              <p className="text-xs text-slate-400 mb-4">Selecciona el tipo de evaluación a realizar.</p>
              <div className="space-y-3">
                <button onClick={() => setEvalMode("operacional")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-navy-800 border border-navy-700 hover:border-electric/50 hover:bg-electric/5 transition-all text-left group">
                  <div className="w-10 h-10 rounded-lg bg-electric/10 border border-electric/20 flex items-center justify-center flex-shrink-0 group-hover:bg-electric/20 transition-all">
                    <Target size={18} className="text-electric" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">Esfuerzo e Impacto</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Matriz operacional — priorización estratégica</p>
                  </div>
                </button>
                <button onClick={() => setEvalMode("roi")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-navy-800 border border-navy-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left group">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-all">
                    <DollarSign size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">ROI Evaluado</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">Retorno sobre inversión — ahorro en horas y COP</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lista de proyectos */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-electric rounded-full animate-spin border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <FolderKanban size={40} className="text-navy-700 mb-3" />
          <p className="text-slate-400 text-sm">
            {search ? "No hay proyectos que coincidan." : "Aún no tienes proyectos. ¡Crea el primero!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((project, i) => {
              const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.pendiente_revision
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.05 }}
                  className="glass-card p-5 flex flex-col gap-4 hover:border-electric/30 transition-all group"
                >
                  {/* Título + badge estado */}
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="text-white font-medium text-sm leading-snug flex-1 cursor-pointer hover:text-electric transition-colors"
                    >
                      {project.title}
                    </h3>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0",
                      statusCfg.class
                    )}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{project.description}</p>
                  )}

                  {/* Barra de progreso del flujo */}
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {FLOW_STEPS.map((_, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-all",
                            idx < statusCfg.step
                              ? "bg-electric"
                              : "bg-navy-700"
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Paso {statusCfg.step} de {FLOW_STEPS.length} — {statusCfg.label}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <ClipboardList size={11} />
                      {project.source === "list" ? "Microsoft Lists" : "Manual"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(project.created_at).toLocaleDateString("es-CO")}
                    </span>
                  </div>

                  <div className="laser-line-h opacity-20 group-hover:opacity-50 transition-opacity" />

                  {/* Acciones diferenciadas por rol */}
                  <div className="flex gap-2">
                    {canEval ? (
                      <button
                        onClick={() => handleEvaluar(project)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-electric/10 border border-electric/30 text-electric text-xs font-medium hover:bg-electric/20 transition-all"
                      >
                        Evaluar proyecto
                      </button>
                    ) : (
                      // Vista usuario — solo ver detalle
                      <button
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-navy-800 border border-navy-700 text-slate-300 text-xs font-medium hover:bg-navy-700 transition-all"
                      >
                        Ver detalle <ChevronRight size={13} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => deleteProject(project.id)}
                        className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Wizards */}
      <AnimatePresence>
        {evalTarget && evalMode === "operacional" && (
          <EvaluationWizard
            projectId={evalTarget.id}
            projectName={evalTarget.title}
            onClose={handleCloseWizard}
          />
        )}
        {evalTarget && evalMode === "roi" && (
          <ROIWizard
            projectId={evalTarget.id}
            projectName={evalTarget.title}
            onClose={handleCloseWizard}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
