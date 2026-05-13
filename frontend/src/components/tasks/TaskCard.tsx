import { useState } from "react"
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProjectTask, TaskPriority, TaskStatus } from "@/types/task"
import {
  useDeleteTask,
  useUpdateChecklistItem,
  useUpdateTask,
} from "@/hooks/useTasks"

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  urgente: "border-red-500/40 bg-red-500/15 text-red-300",
  alta: "border-orange-500/40 bg-orange-500/15 text-orange-200",
  media: "border-blue-500/40 bg-blue-500/15 text-blue-200",
  baja: "border-slate-500/40 bg-slate-500/15 text-slate-300",
}

const STATUS_FLOW: { value: TaskStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "completada", label: "Completa" },
  { value: "cancelada", label: "Cancelada" },
]

const STATUS_BADGE: Record<TaskStatus, string> = {
  pendiente: "border-slate-500/45 bg-slate-500/10 text-slate-300",
  en_progreso: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  completada: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  cancelada: "border-rose-500/30 bg-rose-500/5 text-rose-200/90",
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completa",
  cancelada: "Cancelada",
}

export default function TaskCard({
  task,
  projectId,
  canModify,
}: {
  task: ProjectTask
  projectId: number
  canModify: boolean
}) {
  const [open, setOpen] = useState(true)
  const updateMut = useUpdateTask(projectId)
  const deleteMut = useDeleteTask(projectId)
  const checklistMut = useUpdateChecklistItem(projectId)

  const hasChecklist = task.checklist_total > 0
  const checklistPct =
    task.checklist_total > 0 ? Math.round((task.checklist_done / task.checklist_total) * 100) : 0

  const checklistLocked =
    task.status === "completada" || task.status === "cancelada"

  let dueLabel: string | null = null
  let dueLate = false
  if (task.due_date) {
    const d = new Date(`${task.due_date}T12:00:00`)
    dueLabel = d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    dueLate =
      d < today && task.status !== "completada" && task.status !== "cancelada"
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-700/60 bg-slate-900/55 p-4 shadow-sm",
        task.status === "completada" && "opacity-80",
        task.status === "cancelada" && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                "text-sm font-semibold text-slate-100",
                task.status === "cancelada" && "text-slate-500 line-through",
              )}
            >
              {task.title}
            </h3>
            <Badge variant="outline" className={cn("text-[10px] font-medium", PRIORITY_STYLES[task.priority])}>
              {task.priority}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] font-medium", STATUS_BADGE[task.status])}>
              {STATUS_LABEL[task.status]}
            </Badge>
          </div>
          {canModify && (
            <div className="flex flex-wrap gap-1 pt-1">
              {STATUS_FLOW.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  disabled={updateMut.isPending}
                  onClick={() =>
                    void updateMut.mutateAsync({
                      taskId: task.id,
                      payload: { status: value },
                    })
                  }
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors",
                    task.status === value
                      ? "border-electric/50 bg-electric/15 text-electric"
                      : "border-navy-600/50 bg-transparent text-slate-500 hover:border-slate-600 hover:text-slate-400",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {task.description && (
            <p className="text-xs text-slate-400 whitespace-pre-wrap">{task.description}</p>
          )}
          {dueLabel && (
            <p className={cn("text-xs", dueLate ? "font-medium text-red-400" : "text-slate-500")}>
              Fecha límite: {dueLabel}
              {dueLate ? " · vencida" : ""}
            </p>
          )}
        </div>
        {canModify && (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-red-400 hover:text-red-300"
              disabled={deleteMut.isPending}
              onClick={() => void deleteMut.mutateAsync(task.id)}
              title="Eliminar tarea"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {hasChecklist && (
        <div className="mt-3 border-t border-slate-700/50 pt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 text-left text-xs font-medium text-slate-400 hover:text-slate-200"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Subtareas ({task.checklist_done}/{task.checklist_total})
            <span className="ml-auto h-1.5 flex-1 max-w-[120px] overflow-hidden rounded-full bg-slate-800">
              <span
                className="block h-full rounded-full bg-electric transition-all"
                style={{ width: `${checklistPct}%` }}
              />
            </span>
          </button>
          {open && (
            <ul className="mt-2 space-y-2 pl-6">
              {task.checklist_items.map((it) => (
                <li key={it.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-600"
                    checked={it.is_done}
                    disabled={!canModify || checklistMut.isPending || checklistLocked}
                    onChange={(e) =>
                      void checklistMut.mutateAsync({
                        taskId: task.id,
                        itemId: it.id,
                        is_done: e.target.checked,
                      })
                    }
                  />
                  <span
                    className={cn(
                      "text-sm text-slate-300",
                      it.is_done && "text-slate-500 line-through",
                    )}
                  >
                    {it.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{task.evidence_hint}</p>
    </div>
  )
}
