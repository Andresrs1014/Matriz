// frontend/src/components/projects/SuperadminApprovalModal.tsx
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus, Trash2, Loader2, CheckCircle2, ChevronLeft, Package } from "lucide-react"
import api from "@/lib/api"
import { useProjectActions } from "@/hooks/useProjectActions"
import { cn } from "@/lib/utils"

interface MatrixQuestion {
  id: number
  text: string
  axis: "impact" | "effort"
  weight: number
  category_id: number | null
}

interface Category {
  id: number
  name: string
  description: string | null
  is_default: boolean
}

interface Props {
  projectId: number
  projectTitle: string
  onClose: () => void
  onSuccess: () => void
}

type Step = "select_package" | "select_questions"

export default function SuperadminApprovalModal({ projectId, projectTitle, onClose, onSuccess }: Props) {
  const { superaprobar, loading, error } = useProjectActions()

  const [step, setStep] = useState<Step>("select_package")
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [allQuestions, setAllQuestions] = useState<MatrixQuestion[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [customQuestions, setCustomQuestions] = useState<string[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [loadingQs, setLoadingQs] = useState(false)

  // Cargar paquetes (categorías)
  useEffect(() => {
    api.get("/matrix/categories")
      .then(({ data }) => setCategories(data))
      .finally(() => setLoadingCats(false))
  }, [])

  // Cuando selecciona un paquete → cargar sus preguntas y preseleccionar todas
  async function handleSelectPackage(cat: Category) {
    setSelectedCategory(cat)
    setLoadingQs(true)
    setStep("select_questions")
    try {
      const { data } = await api.get(`/matrix/questions?category_id=${cat.id}`)
      setAllQuestions(data)
      setSelectedIds(data.map((q: MatrixQuestion) => q.id)) // todas preseleccionadas
    } finally {
      setLoadingQs(false)
    }
  }

  function toggleQuestion(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function selectAll() {
    setSelectedIds(allQuestions.map((q) => q.id))
  }

  function deselectAll() {
    setSelectedIds([])
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

  const impactQs = allQuestions.filter((q) => q.axis === "impact")
  const effortQs = allQuestions.filter((q) => q.axis === "effort")
  const totalSelected = selectedIds.length + customQuestions.filter((q) => q.trim()).length

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
            <div className="flex items-center gap-3">
              {step === "select_questions" && (
                <button
                  onClick={() => { setStep("select_package"); setSelectedCategory(null); setAllQuestions([]); setSelectedIds([]) }}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h2 className="text-base font-semibold text-white">
                  {step === "select_package" ? "Aprobar proyecto" : `Paquete: ${selectedCategory?.name}`}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{projectTitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

            {/* PASO 1: Elegir paquete */}
            {step === "select_package" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Elige un paquete de preguntas como base. Luego podrás seleccionar cuáles usar o agregar preguntas propias.
                </p>
                {loadingCats ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No hay paquetes de preguntas creados aún.</p>
                    <p className="text-xs mt-1">Ve a Configuración → Categorías para crearlos.</p>
                  </div>
                ) : (
                  categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleSelectPackage(cat)}
                      className="w-full text-left px-4 py-4 rounded-xl border border-slate-700/50 bg-slate-800/40 hover:border-electric/40 hover:bg-electric/5 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white group-hover:text-electric transition-colors">
                          {cat.name}
                        </span>
                        {cat.is_default && (
                          <span className="text-[10px] bg-electric/10 text-electric px-2 py-0.5 rounded-full border border-electric/20">
                            Default
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-xs text-slate-500 mt-1">{cat.description}</p>
                      )}
                    </button>
                  ))
                )}

                {/* Opción: sin paquete, solo preguntas custom */}
                <button
                  onClick={() => { setStep("select_questions"); setSelectedCategory(null); setAllQuestions([]) }}
                  className="w-full text-left px-4 py-3 rounded-xl border border-dashed border-slate-700/50 text-slate-500 text-sm hover:border-slate-600 hover:text-slate-300 transition-all"
                >
                  + Solo crear preguntas propias sin paquete base
                </button>
              </div>
            )}

            {/* PASO 2: Seleccionar preguntas del paquete */}
            {step === "select_questions" && (
              <div className="space-y-4">
                {loadingQs ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                  </div>
                ) : allQuestions.length > 0 && (
                  <>
                    {/* Controles select all */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-400">
                        {selectedIds.length} de {allQuestions.length} preguntas seleccionadas
                      </p>
                      <div className="flex gap-3">
                        <button onClick={selectAll} className="text-xs text-electric hover:underline">Todas</button>
                        <button onClick={deselectAll} className="text-xs text-slate-500 hover:underline">Ninguna</button>
                      </div>
                    </div>

                    {/* Preguntas de Impacto */}
                    {impactQs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                          Eje Impacto ({impactQs.length})
                        </p>
                        {impactQs.map((q) => {
                          const on = selectedIds.includes(q.id)
                          return (
                            <button key={q.id} onClick={() => toggleQuestion(q.id)}
                              className={cn(
                                "w-full flex items-start gap-3 p-3 rounded-lg border text-left text-sm transition-all",
                                on
                                  ? "bg-cyan-500/10 border-cyan-500/30 text-white"
                                  : "bg-slate-800/40 border-slate-700/40 text-slate-500 hover:border-slate-600"
                              )}>
                              <div className={cn(
                                "w-4 h-4 rounded border mt-0.5 shrink-0 flex items-center justify-center transition-all",
                                on ? "bg-cyan-500 border-cyan-500" : "border-slate-600"
                              )}>
                                {on && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <span className="leading-snug">{q.text}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Preguntas de Esfuerzo */}
                    {effortQs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                          Eje Esfuerzo ({effortQs.length})
                        </p>
                        {effortQs.map((q) => {
                          const on = selectedIds.includes(q.id)
                          return (
                            <button key={q.id} onClick={() => toggleQuestion(q.id)}
                              className={cn(
                                "w-full flex items-start gap-3 p-3 rounded-lg border text-left text-sm transition-all",
                                on
                                  ? "bg-indigo-500/10 border-indigo-500/30 text-white"
                                  : "bg-slate-800/40 border-slate-700/40 text-slate-500 hover:border-slate-600"
                              )}>
                              <div className={cn(
                                "w-4 h-4 rounded border mt-0.5 shrink-0 flex items-center justify-center transition-all",
                                on ? "bg-indigo-500 border-indigo-500" : "border-slate-600"
                              )}>
                                {on && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <span className="leading-snug">{q.text}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Preguntas custom adicionales */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Preguntas adicionales propias
                  </p>
                  {customQuestions.map((q, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        value={q}
                        onChange={(e) => updateCustom(idx, e.target.value)}
                        placeholder={`Pregunta personalizada ${idx + 1}...`}
                        className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                      />
                      <button onClick={() => removeCustom(idx)}
                        className="p-2 text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={addCustom}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-electric transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Agregar pregunta propia
                  </button>
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {step === "select_questions" && (
            <div className="px-6 py-4 border-t border-slate-700/50 flex gap-3 shrink-0">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 text-sm hover:text-white transition-all">
                Cancelar
              </button>
              <button onClick={handleSubmit}
                disabled={loading || totalSelected === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle2 className="w-4 h-4" />
                }
                {loading ? "Aprobando..." : `Aprobar con ${totalSelected} pregunta(s)`}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
