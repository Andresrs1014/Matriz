import { useState } from "react"
import { Loader2, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { TaskCreate, TaskPriority } from "@/types/task"
import { useCreateTask } from "@/hooks/useTasks"

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
    onCreated?.()
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-2xl border border-slate-700/60 bg-slate-900/45 p-4 space-y-3"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-electric/80">Nueva tarea</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          required
          placeholder="Título *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-electric focus:outline-none sm:col-span-2"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-electric focus:outline-none"
        >
          <option value="baja">Prioridad: baja</option>
          <option value="media">Prioridad: media</option>
          <option value="alta">Prioridad: alta</option>
          <option value="urgente">Prioridad: urgente</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-electric focus:outline-none"
        />
      </div>
      <textarea
        placeholder="Descripción (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-electric focus:outline-none"
      />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Subtareas antes de crear</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-electric"
            onClick={() => setChecklistDrafts((d) => [...d, ""])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Añadir ítem
          </Button>
        </div>
        {checklistDrafts.map((line, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              value={line}
              onChange={(e) =>
                setChecklistDrafts((d) => d.map((x, i) => (i === idx ? e.target.value : x)))
              }
              placeholder={`Subtarea ${idx + 1}`}
              className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-electric focus:outline-none"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-slate-500"
              onClick={() => setChecklistDrafts((d) => d.filter((_, i) => i !== idx))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="submit"
        disabled={createMut.isPending || !title.trim()}
        className="w-full sm:w-auto bg-electric text-navy-950 hover:bg-electric-bright"
      >
        {createMut.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando…
          </>
        ) : (
          "Crear tarea"
        )}
      </Button>
    </form>
  )
}
