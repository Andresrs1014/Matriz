import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Trash2, Pencil, Check, X, TrendingUp, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Question, QuestionCreate } from "@/types/settings"

interface Props {
  categoryId: number
  questions:  Question[]
  onCreate:   (p: QuestionCreate) => Promise<Question | null>
  onUpdate:   (id: number, p: Partial<Question>) => Promise<void>
  onDelete:   (id: number) => Promise<void>
}

const AXIS_CONFIG = {
  impact: { label: "Impacto", icon: TrendingUp, color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/30"   },
  effort: { label: "Esfuerzo", icon: Zap,       color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/30" },
}

export default function QuestionManager({ categoryId, questions, onCreate, onUpdate, onDelete }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState<number | null>(null)
  const [text,     setText]     = useState("")
  const [axis,     setAxis]     = useState<"impact" | "effort">("impact")
  const [weight,   setWeight]   = useState(1.0)
  const [saving,   setSaving]   = useState(false)
  const [editing,  setEditing]  = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [editWeight, setEditWeight] = useState(1.0)

  const byAxis = (a: "impact" | "effort") =>
    questions.filter((q) => q.category_id === categoryId && q.axis === a)
      .sort((a, b) => a.order - b.order)

  async function handleCreate() {
    if (!text.trim()) return
    setSaving(true)
    await onCreate({
      category_id: categoryId,
      axis,
      text: text.trim(),
      weight,
      order: byAxis(axis).length + 1,
    })
    setText(""); setWeight(1.0); setSaving(false); setShowForm(false)
  }

  function startEdit(q: Question) {
    setEditing(q.id); setEditText(q.text); setEditWeight(q.weight)
  }

  async function saveEdit(id: number) {
    await onUpdate(id, { text: editText, weight: editWeight })
    setEditing(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Preguntas</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-xs hover:bg-electric/20 transition-all"
        >
          <Plus size={13} /> Nueva pregunta
        </button>
      </div>

      {/* Formulario nueva pregunta */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 space-y-3"
          >
            {/* Eje */}
            <div className="flex gap-2">
              {(["impact", "effort"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAxis(a)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-medium border transition-all",
                    axis === a
                      ? AXIS_CONFIG[a].bg + " " + AXIS_CONFIG[a].color
                      : "bg-navy-800 border-navy-600 text-slate-400 hover:border-navy-500"
                  )}
                >
                  {AXIS_CONFIG[a].label}
                </button>
              ))}
            </div>

            {/* Texto */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribe la pregunta..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all resize-none"
            />

            {/* Peso */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400 whitespace-nowrap">Peso: <span className="text-white font-semibold">{weight.toFixed(1)}×</span></label>
              <input
                type="range" min={0.5} max={2.0} step={0.1}
                value={weight}
                onChange={(e) => setWeight(parseFloat(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-xs text-slate-500 w-6">x{weight.toFixed(1)}</span>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white border border-navy-600 transition-all">
                <X size={12} /> Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving || !text.trim()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-electric text-white disabled:opacity-40 transition-all">
                {saving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={12} />}
                Agregar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preguntas por eje */}
      {(["impact", "effort"] as const).map((a) => {
        const config = AXIS_CONFIG[a]
        const axisQs = byAxis(a)
        return (
          <div key={a}>
            <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border w-fit mb-3", config.bg)}>
              <config.icon size={13} className={config.color} />
              <span className={cn("text-xs font-semibold", config.color)}>{config.label}</span>
              <span className="text-xs text-slate-500">({axisQs.length})</span>
            </div>

            {axisQs.length === 0 ? (
              <p className="text-xs text-slate-600 px-2 mb-4">Sin preguntas en este eje</p>
            ) : (
              <div className="space-y-2 mb-4">
                {axisQs.map((q) => (
                  <div key={q.id} className={cn(
                    "p-3 rounded-xl border transition-all",
                    q.is_active ? "bg-navy-800/50 border-navy-700" : "bg-navy-900/50 border-navy-800 opacity-50"
                  )}>
                    {editing === q.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-navy-700 border border-navy-500 text-white text-sm focus:outline-none focus:border-electric transition-all resize-none"
                        />
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-slate-400 whitespace-nowrap">Peso: <span className="text-white font-semibold">{editWeight.toFixed(1)}×</span></label>
                          <input type="range" min={0.5} max={2.0} step={0.1} value={editWeight} onChange={(e) => setEditWeight(parseFloat(e.target.value))} className="flex-1 accent-blue-500" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-slate-500 hover:text-white border border-navy-600 transition-all"><X size={13} /></button>
                          <button onClick={() => saveEdit(q.id)} className="p-1.5 rounded-lg bg-electric text-white transition-all"><Check size={13} /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white leading-snug">{q.text}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-slate-500">Peso: <span className="text-slate-300">{q.weight.toFixed(1)}×</span></span>
                            <span className="text-[10px] text-slate-600">Orden: {q.order}</span>
                            {!q.is_active && <span className="text-[10px] text-red-400">Inactiva</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => onUpdate(q.id, { is_active: !q.is_active })} className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all" title={q.is_active ? "Desactivar" : "Activar"}>
                            {q.is_active ? <Check size={13} /> : <X size={13} />}
                          </button>
                          <button onClick={() => startEdit(q)} className="p-1.5 rounded-lg text-slate-500 hover:text-electric hover:bg-electric/10 transition-all">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => onDelete(q.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
