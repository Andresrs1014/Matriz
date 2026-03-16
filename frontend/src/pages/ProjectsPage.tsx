// frontend/src/pages/ProjectsPage.tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus, Search, FolderKanban, Trash2, ClipboardList,
  Calendar, Target, DollarSign, X, ChevronRight,
  ArrowUpCircle, CheckCircle2, PlayCircle, BadgeCheck,
  XCircle,
} from "lucide-react"
import { useProjects } from "@/hooks/useProjects"
import { useProjectActions } from "@/hooks/useProjectActions"
import { useAuthStore } from "@/store/authStore"
import {
  isAdmin,
  canEscalar, canSuperaprobar, canIniciarEvaluacion,
  canMarcarEvaluado, canProveerSalario, canCompletarROI,
  canRechazar,
} from "@/lib/roles"
import EvaluationWizard from "@/components/evaluation/EvaluationWizard"
import SuperadminApprovalModal from "@/components/projects/SuperadminApprovalModal"
import SuperadminSalaryModal from "@/components/projects/SuperadminSalaryModal"
import AdminROIForm from "@/components/projects/AdminROIForm"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"

const STATUS_CONFIG: Record<string, { label: string; class: string; step: number }> = {
  pendiente_revision:  { label: "Pendiente revisión",  class: "bg-slate-500/20 text-slate-300 border-slate-500/30",   step: 1 },
  escalado:            { label: "Escalado",            class: "bg-purple-500/20 text-purple-400 border-purple-500/30", step: 2 },
  preguntas_asignadas: { label: "Preguntas asignadas", class: "bg-amber-500/20 text-amber-400 border-amber-500/30",    step: 3 },
  en_evaluacion:       { label: "En evaluación",       class: "bg-blue-500/20 text-blue-400 border-blue-500/30",       step: 4 },
  evaluado:            { label: "Evaluado",            class: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", step: 5 },
  pendiente_salario:   { label: "Pendiente salario",   class: "bg-orange-500/20 text-orange-400 border-orange-500/30", step: 6 },
  calculando_roi:      { label: "Calculando ROI",      class: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",       step: 7 },
  aprobado_final:      { label: "Aprobado final",      class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", step: 8 },
  rechazado:           { label: "Rechazado",           class: "bg-red-500/20 text-red-400 border-red-500/30",          step: 0 },
}

const FLOW_TOTAL = 8

type ModalType = "superaprobar" | "salario" | "roi" | "matrix" | null

export default function ProjectsPage() {
  const { projects, loading, createProject, deleteProject, fetchProjects } = useProjects()
  const { escalar, iniciarEvaluacion, rechazar } = useProjectActions()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)

  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [modal, setModal] = useState<ModalType>(null)

  const filtered = projects.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  function openModal(project: Project, type: ModalType) {
    setActiveProject(project)
    setModal(type)
  }

  function closeModal() {
    setActiveProject(null)
    setModal(null)
  }

  async function handleModalSuccess() {
    closeModal()
    await fetchProjects()
  }

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

  // Acciones directas (sin modal)
  async function handleEscalar(project: Project) {
    await escalar(project.id)
    await fetchProjects()
  }

  async function handleIniciarEval(project: Project) {
    await iniciarEvaluacion(project.id)
    await fetchProjects()
  }

  async function handleRechazar(project: Project) {
    if (!confirm(`¿Seguro que deseas rechazar "${project.title}"?`)) return
    await rechazar(project.id)
    await fetchProjects()
  }

  // Botón de acción principal según rol + estado
  function renderActionButton(project: Project) {
    const s = project.status

    if (canEscalar(user, s))
      return (
        <button onClick={() => handleEscalar(project)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-all">
          <ArrowUpCircle className="w-3.5 h-3.5" /> Escalar a Superadmin
        </button>
      )

    if (canSuperaprobar(user, s))
      return (
        <button onClick={() => openModal(project, "superaprobar")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all">
          <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar + Preguntas
        </button>
      )

    if (canIniciarEvaluacion(user, s))
      return (
        <button onClick={() => handleIniciarEval(project)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-all">
          <PlayCircle className="w-3.5 h-3.5" /> Iniciar evaluación
        </button>
      )

    if (canMarcarEvaluado(user, s))
      return (
        <button onClick={() => openModal(project, "matrix")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-electric/10 border border-electric/30 text-electric text-xs font-medium hover:bg-electric/20 transition-all">
          <Target className="w-3.5 h-3.5" /> Evaluar Impacto/Esfuerzo
        </button>
      )

    if (canProveerSalario(user, s))
      return (
        <button onClick={() => openModal(project, "salario")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all">
          <DollarSign className="w-3.5 h-3.5" /> Proveer salario
        </button>
      )

    if (canCompletarROI(user, s))
      return (
        <button onClick={() => openModal(project, "roi")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all">
          <DollarSign className="w-3.5 h-3.5" /> Completar ROI
        </button>
      )

    if (s === "aprobado_final")
      return (
        <button onClick={() => navigate(`/projects/${project.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all">
          <BadgeCheck className="w-3.5 h-3.5" /> Ver resultado
        </button>
      )

    // Estado espectador (coordinador / usuario en cualquier estado)
    return (
      <button onClick={() => navigate(`/projects/${project.id}`)}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-all">
        Ver detalle <ChevronRight className="w-3.5 h-3.5" />
      </button>
    )
  }

  return (
    <div className="p-6 mx-auto w-full max-w-[1610px] space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proyectos..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-navy-800 border border-navy-600 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all"
          />
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-electric text-white text-sm font-medium hover:bg-electric-bright shadow-glow-blue transition-all whitespace-nowrap">
          <Plus className="w-4 h-4" /> Nuevo proyecto
        </button>
      </div>

      {/* Modal crear proyecto */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-6 w-full max-w-md"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Nuevo Proyecto</h2>
                <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Nombre *</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Automatización de despachos" required
                    className="w-full px-4 py-2.5 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Descripción</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    rows={3} placeholder="Objetivo del proyecto..."
                    className="w-full px-4 py-2.5 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 rounded-lg border border-navy-600 text-slate-400 text-sm hover:text-white transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={creating || !title.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-electric text-white text-sm font-medium hover:bg-electric-bright disabled:opacity-40 transition-all">
                    {creating ? "Creando..." : "Crear proyecto"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lista proyectos */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-electric rounded-full animate-spin border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <FolderKanban className="w-10 h-10 text-navy-700 mb-3" />
          <p className="text-slate-400 text-sm">
            {search ? "No hay proyectos que coincidan." : "Aún no hay proyectos. ¡Crea el primero!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((project, i) => {
              const sc = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.pendiente_revision
              return (
                <motion.div key={project.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.05 }}
                  className="glass-card p-5 flex flex-col gap-4 hover:border-electric/30 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 onClick={() => navigate(`/projects/${project.id}`)}
                      className="text-white font-medium text-sm leading-snug flex-1 cursor-pointer hover:text-electric transition-colors">
                      {project.title}
                    </h3>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0", sc.class)}>
                      {sc.label}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{project.description}</p>
                  )}

                  {/* Barra de progreso */}
                  {sc.step > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1">
                        {Array.from({ length: FLOW_TOTAL }).map((_, idx) => (
                          <div key={idx} className={cn(
                            "h-1 flex-1 rounded-full transition-all",
                            idx < sc.step ? "bg-electric" : "bg-navy-700"
                          )} />
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Paso {sc.step} de {FLOW_TOTAL} — {sc.label}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <ClipboardList className="w-3 h-3" />
                      {project.source === "list" ? "Microsoft Lists" : "Manual"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(project.created_at).toLocaleDateString("es-CO")}
                    </span>
                  </div>

                  <div className="laser-line-h opacity-20 group-hover:opacity-50 transition-opacity" />

                  <div className="flex gap-2">
                    {renderActionButton(project)}
                    {canRechazar(user, project.status) && (
                      <button onClick={() => handleRechazar(project)}
                        className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin(user) && (
                      <button onClick={() => deleteProject(project.id)}
                        className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modales */}
      <AnimatePresence>
        {activeProject && modal === "superaprobar" && (
          <SuperadminApprovalModal
          projectId={activeProject.id}
          projectTitle={activeProject.title}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
          showSalaryCorrection={activeProject.status === "pendiente_salario"}  // ← solo esto
          />
          )}

        {activeProject && modal === "salario" && (
          <SuperadminSalaryModal
            projectId={activeProject.id}
            projectTitle={activeProject.title}
            onClose={closeModal}
            onSuccess={handleModalSuccess}
          />
        )}
        {activeProject && modal === "roi" && (
          <AdminROIForm
            projectId={activeProject.id}
            projectTitle={activeProject.title}
            onClose={closeModal}
            onSuccess={handleModalSuccess}
          />
        )}
        {activeProject && modal === "matrix" && (
          <EvaluationWizard
            projectId={activeProject.id}
            projectName={activeProject.title}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
