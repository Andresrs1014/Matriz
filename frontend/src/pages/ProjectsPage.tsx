import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Search, FolderKanban, Trash2, ClipboardList, Calendar } from "lucide-react"
import { useProjects } from "@/hooks/useProjects"
import EvaluationWizard from "@/components/evaluation/EvaluationWizard"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"

const STATUS_CONFIG = {
  nuevo:        { label: "Nuevo",       class: "bg-slate-500/20 text-slate-300 border-slate-500/30"   },
  en_progreso:  { label: "En progreso", class: "bg-electric/20 text-electric border-electric/30"      },
  completado:   { label: "Completado",  class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  cancelado:    { label: "Cancelado",   class: "bg-red-500/20 text-red-400 border-red-500/30"         },
}

export default function ProjectsPage() {
  const { projects, loading, createProject, deleteProject } = useProjects()

  const [search,      setSearch]      = useState("")
  const [showCreate,  setShowCreate]  = useState(false)
  const [evaluating,  setEvaluating]  = useState<Project | null>(null)

  // Form de creación
  const [title,       setTitle]       = useState("")
  const [description, setDescription] = useState("")
  const [creating,    setCreating]    = useState(false)

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

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="glass-card p-6 w-full max-w-md"
            >
              <h2 className="text-white font-semibold mb-1">Nuevo Proyecto</h2>
              <p className="text-xs text-slate-400 mb-5">Los proyectos también pueden llegar desde Microsoft Lists.</p>
              <div className="laser-line-h mb-5 opacity-40" />

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Nombre del proyecto *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Automatización de despachos"
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase tracking-wider">Descripción</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe brevemente el objetivo del proyecto..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 rounded-lg border border-navy-600 text-slate-400 text-sm hover:text-white hover:border-navy-500 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !title.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-electric text-white text-sm font-medium hover:bg-electric-bright shadow-glow-blue disabled:opacity-40 transition-all"
                  >
                    {creating ? "Creando..." : "Crear proyecto"}
                  </button>
                </div>
              </form>
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
            {filtered.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-5 flex flex-col gap-4 hover:border-electric/30 transition-all group"
              >
                {/* Título + badge estado */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-white font-medium text-sm leading-snug flex-1">{project.title}</h3>
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0",
                    STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG]?.class ?? STATUS_CONFIG.nuevo.class
                  )}>
                    {STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG]?.label ?? project.status}
                  </span>
                </div>

                {/* Descripción */}
                {project.description && (
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{project.description}</p>
                )}

                {/* Fuente + fecha */}
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

                {/* Línea sable */}
                <div className="laser-line-h opacity-20 group-hover:opacity-50 transition-opacity" />

                {/* Acciones */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEvaluating(project)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-electric/10 border border-electric/30 text-electric text-xs font-medium hover:bg-electric/20 transition-all"
                  >
                    Evaluar en Matriz
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Wizard de evaluación */}
      <AnimatePresence>
        {evaluating && (
          <EvaluationWizard
            projectId={evaluating.id}
            projectName={evaluating.title}
            onClose={() => setEvaluating(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
