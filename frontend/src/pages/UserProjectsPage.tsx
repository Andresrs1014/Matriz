// frontend/src/pages/UserProjectsPage.tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, FolderKanban, XCircle, AlertCircle, ChevronRight } from "lucide-react"
import api from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/project"
import ProjectSubmitForm from "@/components/projects/ProjectSubmitForm"

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
          <ProjectSubmitForm
            onClose={() => setShowForm(false)}
            onSuccess={async () => {
              setShowForm(false)
              await fetchProjects()
            }}
          />
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
                      {(p.okr_objectives ?? p.description) && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {p.okr_objectives ?? p.description}
                        </p>
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
                    <div className="space-y-1">
                      <span className="block text-xs text-slate-600">
                        {new Date(p.created_at).toLocaleDateString("es-CO", {
                          year: "numeric", month: "short", day: "numeric"
                        })}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        Subió: <span className="text-slate-300">{p.submitted_by_name ?? (user?.full_name ?? user?.email ?? "Sin dato")}</span>
                      </span>
                    </div>
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
