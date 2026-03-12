// frontend/src/components/projects/SuperadminApprovalModal.tsx
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Trash2, Loader2, CheckCircle2 } from "lucide-react"
import api from "@/lib/api"
import { useProjectActions } from "@/hooks/useProjectActions"
import { cn } from "@/lib/utils"

interface MatrixQuestion {
  id: number
  text: string
  category_name?: string
}

interface Props {
  projectId: number
  projectTitle: string
  onClose: () => void
  onSuccess: () => void
}

export default function SuperadminApprovalModal({ projectId, projectTitle, onClose, onSuccess }: Props) {
  const { superaprobar, loading, error } = useProjectActions()
  const [availableQuestions, setAvailableQuestions] = useState<MatrixQuestion[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [customQuestions, setCustomQuestions] = useState<string[]>([""])
  const [loadingQ, setLoadingQ] = useState(true)

  useEffect(() => {
    api.get("/matrix/questions")
      .then(({ data }) => setAvailableQuestions(data))
      .finally(() => setLoadingQ(false))
  }, [])

  function toggleQuestion(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function addCustom() {
    setCustomQuestions((prev) => [...prev, ""])
  }

  function updateCustom(idx: number, value: string) {
    setCustomQuestions((prev) => prev.map((v, i) => (i === idx ? value : v)))
  }

  function removeCustom(idx: number) {
    setCustomQuestions((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    const filledCustom = customQuestions.filter((q) => q.trim().length > 0)
    if (selectedIds.length === 0 && filledCustom.length === 0) return
    const result = await superaprobar(projectId, {
      question_ids: selectedIds,
      custom_questions: filledCustom,
    })
    if (result) onSuccess()
  }

  const totalSelected = selectedIds.length + customQuestions.filter((q) => q.trim()).length

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 shrink-0">
            <div>
              <h2 className="text-base font-semibold text-white">Aprobar proyecto</h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{projectTitle}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
            {/* Preguntas existentes */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Selecciona preguntas del banco
              </p>
              {loadingQ ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                </div>
              ) : availableQuestions.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No hay preguntas en el banco aún.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {availableQuestions.map((q) => {
                    const selected = selectedIds.includes(q.id)
                    return (
                      <button
                        key={q.id}
                        onClick={() => toggleQuestion(q.id)}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-lg border text-left text-sm transition-all",
                          selected
                            ? "bg-electric/10 border-electric/40 text-white"
                            : "bg-slate-800/50 border-slate-700/40 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border mt-0.5 shrink-0 flex items-center justify-center transition-all",
                          selected ? "bg-electric border-electric" : "border-slate-600"
                        )}>
                          {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className="leading-snug">{q.text}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Preguntas custom */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Preguntas nuevas (opcionales)
              </p>
              <div className="space-y-2">
                {customQuestions.map((q, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      value={q}
                      onChange={(e) => updateCustom(idx, e.target.value)}
                      placeholder={`Pregunta ${idx + 1}...`}
                      className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                    />
                    {customQuestions.length > 1 && (
                      <button
                        onClick={() => removeCustom(idx)}
                        className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addCustom}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-electric transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar otra pregunta
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-700/50 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 text-sm hover:text-white transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || totalSelected === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <CheckCircle2 className="w-4 h-4" />
              }
              {loading ? "Aprobando..." : `Aprobar con ${totalSelected} pregunta(s)`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
