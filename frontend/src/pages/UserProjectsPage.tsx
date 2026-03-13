// frontend/src/pages/UserProjectsPage.tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, FolderKanban, XCircle, AlertCircle, ChevronRight, X } from "lucide-react"
import api from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"

const STATUS_CONFIG: Record<string, { label: string; class: string; step: number }> = {
  pendiente_revision:  { label: "Pendiente revisión",  class: "bg-slate-500/20 text-slate-300 border-slate-500/30",    step: 1 },
  escalado:            { label: "En revisión",         class: "bg-purple-500/20 text-purple-400 border-purple-500/30", step: 2 },
  preguntas_asignadas: { label: "Aprobado, en cola",   class: "bg-amber-500/20 text-amber-400 border-amber-500/30",    step: 3 },
  en_evaluacion:       { label: "Siendo evaluado",     class: "bg-blue-500/20 text-blue-400 border-blue-500/30",       step: 4 },
  evaluado:            { label: "Evaluado",            class: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30", step: 5 },
  pendiente_salario:   { label: "Siendo evaluado",     class: "bg-blue-500/20 text-blue-400 border-blue-500/30",       step: 6 },
  calculando_roi:      { label: "Siendo evaluado",     class: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",       step: 7 },
  aprobado_final:      { label: "✓ Aprobado",          class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", step: 8 },
  rechazado:           { label: "Rechazado",           class: "bg-red-500/20 text-red-400 border-red-500/30",          step: 0 },
}

const FLOW_TOTAL = 8

export default function UserProjectsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [fetchError, setFetchError] = useState<string | null>(null)

  async function fetchProjects() {
    try {
      const { data } = await api.get("/projects")
      setFetchError(null)
      setProjects(data)
    } catch {
      setFetchError("No se pudieron cargar tus proyectos. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setCreateError("")
    try {
      await api.post("/projects", {
        title: title.trim(),
        description: description.trim() || null,
      })
      setTitle("")
      setDescription("")
      setShowForm(false)
      await fetchProjects()
    } catch (err: any) {
      setCreateError(
        err?.response?.status === 400
          ? (err?.response?.data?.detail ?? "Error al crear el proyecto.")
          : "Error al crear el proyecto."
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            Mis proyectos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Hola, <span className="text-electric">{user?.full_name ?? user?.email}</span> 👋
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-electric text-white text-sm font-medium hover:bg-electric-bright shadow-glow-blue transition-all">
          <Plus className="w-4 h-4" /> Nuevo proyecto
        </button>
      </motion.div>

      {/* Modal crear */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                <h2 className="text-base font-semibold text-white">Nuevo proyecto</h2>
                <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Nombre *</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Automatización de reportes" required
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Descripción <span className="text-slate-600">(opcional)</span>
                  </label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    rows={3} placeholder="¿Qué problema resuelve tu proyecto?"
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors resize-none"
                  />
                </div>
                {createError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {createError}
                  </p>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 text-sm hover:text-white transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={creating || !title.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-electric text-white text-sm font-medium hover:bg-electric-bright disabled:opacity-40 transition-all">
                    {creating ? "Creando..." : "Crear proyecto"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="w-6 h-6 border-2 border-electric/30 border-t-electric rounded-full animate-spin" />
        </div>
      ) : fetchError ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
          <AlertCircle className="w-10 h-10 opacity-30" />
          <p className="text-sm text-red-400">{fetchError}</p>
          <button onClick={fetchProjects}
            className="text-xs text-electric hover:underline">
            Reintentar
          </button>
        </motion.div>
      ) : projects.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
          <FolderKanban className="w-12 h-12 opacity-20" />
          <p className="text-sm">Aún no tienes proyectos.</p>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm hover:bg-electric/20 transition-all">
            <Plus className="w-4 h-4" /> Crear mi primer proyecto
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {projects.map((p, i) => {
              const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pendiente_revision
              return (
                <motion.div key={p.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/60 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">{p.title}</h3>
                      {p.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                    <span className={cn(
                      "text-[11px] font-medium px-2.5 py-1 rounded-full border shrink-0",
                      sc.class
                    )}>
                      {sc.label}
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  {sc.step > 0 && (
                    <div className="mt-4 space-y-1.5">
                      <div className="flex gap-1">
                        {Array.from({ length: FLOW_TOTAL }).map((_, idx) => (
                          <div key={idx} className={cn(
                            "h-1.5 flex-1 rounded-full transition-all",
                            idx < sc.step ? "bg-electric" : "bg-slate-700/60"
                          )} />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>Enviado</span>
                        <span>Paso {sc.step} de {FLOW_TOTAL}</span>
                        <span>Aprobado</span>
                      </div>
                    </div>
                  )}

                  {p.status === "rechazado" && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
                      <XCircle className="w-3.5 h-3.5" />
                      Tu proyecto fue rechazado. Puedes contactar al equipo para más información.
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-slate-600">
                      {new Date(p.created_at).toLocaleDateString("es-CO", {
                        year: "numeric", month: "short", day: "numeric"
                      })}
                    </span>
                    <button onClick={() => navigate(`/projects/${p.id}`)}
                      className="flex items-center gap-1.5 text-xs text-electric hover:text-electric-bright transition-colors font-medium">
                      Ver detalle <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
