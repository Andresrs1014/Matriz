import { useMemo, useState } from "react"
import { ClipboardList, Info } from "lucide-react"

import OKRProgressBar from "@/components/tasks/OKRProgressBar"
import TaskCard from "@/components/tasks/TaskCard"
import TaskCreateForm from "@/components/tasks/TaskCreateForm"
import { useProjectProgress, useTasks } from "@/hooks/useTasks"
import type { TaskStatus } from "@/types/task"
import { cn } from "@/lib/utils"

type FilterKey = "todos" | TaskStatus

export default function ProjectTasksPanel({
  projectId,
  canModify,
}: {
  projectId: number
  canModify: boolean
}) {
  const { data: tasks = [], isLoading, isError } = useTasks(projectId)
  const { data: progress } = useProjectProgress(projectId)
  const [filter, setFilter] = useState<FilterKey>("todos")

  const filtered = useMemo(() => {
    if (filter === "todos") return tasks
    return tasks.filter((t) => t.status === filter)
  }, [tasks, filter])

  const { pending, done } = useMemo(() => {
    const p = filtered.filter((t) => t.status !== "completada")
    const d = filtered.filter((t) => t.status === "completada")
    return { pending: p, done: d }
  }, [filtered])

  const filters: { key: FilterKey; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "pendiente", label: "Pendientes" },
    { key: "en_progreso", label: "En progreso" },
    { key: "completada", label: "Completadas" },
  ]

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-electric/80">
            Ejecución
          </p>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-electric" />
            Tareas del proyecto
          </h2>
          <p className="text-sm text-slate-400">
            Progreso del OKR según tareas completadas (no altera el flujo de aprobación).
          </p>
        </div>
      </div>

      <OKRProgressBar progress={progress} />

      {!canModify && (
        <div
          className="flex gap-3 rounded-2xl border border-slate-700/60 bg-slate-900/35 p-4 text-sm text-slate-400"
          role="status"
        >
          <Info className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
          <p>
            En este expediente las tareas son de solo lectura para ti. Pueden crearlas o editarlas el{" "}
            <span className="text-slate-300">dueño del OKR</span>, un{" "}
            <span className="text-slate-300">superadmin</span> (en cualquier proyecto) o el{" "}
            <span className="text-slate-300">equipo de desarrollo</span> cuando el proyecto está asignado a esa área.
          </p>
        </div>
      )}

      <TaskCreateForm projectId={projectId} canModify={canModify} />

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-electric/50 bg-electric/15 text-electric"
                : "border-slate-600 bg-slate-800/50 text-slate-400 hover:border-slate-500",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <p className="text-sm text-slate-500">Cargando tareas…</p>
      )}
      {isError && (
        <p className="text-sm text-red-400">No se pudieron cargar las tareas.</p>
      )}
      {!isLoading && !isError && tasks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/30 py-14 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-2 text-sm text-slate-500">Aún no hay tareas registradas.</p>
        </div>
      )}

      {!isLoading && !isError && tasks.length > 0 && (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-3">
              {pending.map((t) => (
                <TaskCard key={t.id} task={t} projectId={projectId} canModify={canModify} />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Completadas
              </p>
              <div className="space-y-3">
                {done.map((t) => (
                  <TaskCard key={t.id} task={t} projectId={projectId} canModify={canModify} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
