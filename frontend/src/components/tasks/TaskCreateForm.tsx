import { useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { TaskCreate, TaskPriority } from "@/types/task"
import { useCreateTask } from "@/hooks/useTasks"
import { cn } from "@/lib/utils"

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
]

const fieldBase =
  "w-full rounded-md border border-navy-600/35 bg-navy-950/45 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 " +
  "transition-[border-color,box-shadow] focus:border-electric/45 focus:outline-none focus:ring-1 focus:ring-electric/25"

export default function TaskCreateForm({
  projectId,
  canModify,
  onCreated,
}: {
  projectId: number
  canModify: boolean
  onCreated?: () => void
}) {
  const createMut = useCreateTask(projectId)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("media")
  const [dueDate, setDueDate] = useState("")
  const [checklistDrafts, setChecklistDrafts] = useState<string[]>([])
  const [checklistOpen, setChecklistOpen] = useState(false)

  if (!canModify) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const payload: TaskCreate = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      due_date: dueDate || undefined,
      checklist_items: checklistDrafts
        .map((t, i) => ({ text: t.trim(), sort_order: i }))
        .filter((x) => x.text.length > 0),
    }
    await createMut.mutateAsync(payload)
    setTitle("")
    setDescription("")
    setPriority("media")
    setDueDate("")
    setChecklistDrafts([])
    setChecklistOpen(false)
    onCreated?.()
  }

  const draftCount = checklistDrafts.filter((t) => t.trim()).length

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="relative overflow-hidden rounded-xl border border-navy-600/40 bg-[rgba(5,15,46,0.55)] backdrop-blur-md shadow-[0_0_0_1px_rgba(59,130,246,0.06)]"
    >
      <div className="laser-line-h opacity-70" aria-hidden />
      <div className="border-l-2 border-electric/30 pl-4 pr-4 pb-4 pt-3 sm:pl-5 sm:pr-5">
        <div className="mb-4 flex flex-col gap-0.5">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.28em] text-electric/70">
            Registro
          </p>
          <p className="text-xs text-slate-500">Nueva tarea de ejecución</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="task-title" className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Título<span className="text-electric/80"> *</span>
            </label>
            <input
              id="task-title"
              required
              placeholder="Identificador de la acción"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(fieldBase, "font-medium")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Prioridad
              </span>
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPriority(value)}
                    className={cn(
                      "rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                      priority === value
                        ? "border-electric/50 bg-electric/15 text-electric"
                        : "border-navy-600/50 bg-transparent text-slate-500 hover:border-slate-600 hover:text-slate-400",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="task-due" className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Fecha límite
              </label>
              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={cn(fieldBase, "font-mono text-slate-300 [color-scheme:dark]")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="task-desc" className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Notas <span className="normal-case tracking-normal text-slate-600">(opcional)</span>
            </label>
            <textarea
              id="task-desc"
              placeholder="Contexto mínimo para el equipo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={cn(fieldBase, "resize-none text-slate-300")}
            />
          </div>

          <div className="rounded-md border border-navy-600/30 bg-navy-950/25">
            <button
              type="button"
              onClick={() => setChecklistOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-navy-900/40"
            >
              {checklistOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
              )}
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                Subtareas antes de crear
              </span>
              {draftCount > 0 && (
                <span className="ml-auto font-mono text-[10px] tabular-nums text-electric/80">
                  {draftCount}
                </span>
              )}
            </button>
            {checklistOpen && (
              <div className="space-y-2 border-0 border-t border-navy-600/25 px-3 pb-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 font-mono text-[10px] uppercase tracking-wider text-electric hover:bg-electric/10 hover:text-electric-bright"
                  onClick={() => setChecklistDrafts((d) => [...d, ""])}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Ítem
                </Button>
                {checklistDrafts.map((line, idx) => (
                  <div key={idx} className="flex gap-1.5">
                    <span className="mt-2 font-mono text-[10px] tabular-nums text-slate-600" aria-hidden>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <input
                      value={line}
                      onChange={(e) =>
                        setChecklistDrafts((d) => d.map((x, i) => (i === idx ? e.target.value : x)))
                      }
                      placeholder="Descripción del ítem"
                      className={cn(fieldBase, "py-1.5 text-xs")}
                    />
                    <button
                      type="button"
                      onClick={() => setChecklistDrafts((d) => d.filter((_, i) => i !== idx))}
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-slate-600 transition-colors hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Quitar ítem"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={createMut.isPending || !title.trim()}
            className={cn(
              "relative w-full overflow-hidden rounded-md border py-2.5 font-mono text-xs font-medium uppercase tracking-[0.22em] transition-all",
              "border-electric/35 bg-electric/[0.08] text-electric hover:border-electric/55 hover:bg-electric/[0.14]",
              "disabled:pointer-events-none disabled:opacity-35",
            )}
          >
            {createMut.isPending ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Procesando
              </span>
            ) : (
              "Registrar tarea"
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
