import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, ChevronRight, ChevronLeft, LayoutGrid } from "lucide-react"
import { useNavigate } from "react-router-dom"
import QuestionStep from "./QuestionStep"
import ScoreResult  from "./ScoreResult"
import { useMatrix } from "@/hooks/useMatrix"
import type { CategoryRead, MatrixQuestion } from "@/types/matrix"
import type { QuadrantKey } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface EvaluationWizardProps {
  projectId:   number
  projectName: string
  onClose:     () => void
}

interface EvalResult {
  impactScore: number
  effortScore: number
  quadrant:    QuadrantKey
}

export default function EvaluationWizard({ projectId, projectName, onClose }: EvaluationWizardProps) {
  const navigate = useNavigate()
  const { categories, questions, fetchQuestions, submitEvaluation } = useMatrix()

  const [selectedCategory, setSelectedCategory] = useState<CategoryRead | null>(null)
  const [answers,          setAnswers]          = useState<Record<number, number>>({})
  const [step,             setStep]             = useState(0)
  const [notes,            setNotes]            = useState("")
  const [loading,          setLoading]          = useState(false)
  const [result,           setResult]           = useState<EvalResult | null>(null)

  // Ordena: primero impacto, luego esfuerzo
  const ordered: MatrixQuestion[] = [
    ...questions.filter((q) => q.axis === "impact").sort((a, b) => a.order - b.order),
    ...questions.filter((q) => q.axis === "effort").sort((a, b) => a.order - b.order),
  ]

  const current     = ordered[step]
  const isLast      = step === ordered.length - 1

  async function handleCategorySelect(category: CategoryRead) {
    setSelectedCategory(category)
    setAnswers({})
    setStep(0)
    await fetchQuestions(category.id)
  }

  function handleAnswer(value: number) {
    setAnswers((prev) => ({ ...prev, [current.id]: value }))
  }

  function handleNext() {
    if (answers[current.id] === undefined) return
    if (!isLast) { setStep((s) => s + 1); return }
    handleSubmit()
  }

  async function handleSubmit() {
    if (!selectedCategory) return
    setLoading(true)
    const responses = ordered.map((q) => ({ question_id: q.id, value: answers[q.id] as 1|2|3|4|5 }))
    const evaluation = await submitEvaluation(projectId, {
      responses,
      category_id: selectedCategory.id,
      notes: notes || undefined,
    })
    if (evaluation) {
      setResult({
        impactScore: evaluation.impact_score,
        effortScore: evaluation.effort_score,
        quadrant:    evaluation.quadrant as QuadrantKey,
      })
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        className="glass-card p-6 w-full max-w-lg relative"
      >
        {/* Header */}
        {!result && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Evaluando proyecto</p>
              <p className="text-white font-semibold text-sm truncate max-w-xs">{projectName}</p>
              {selectedCategory && (
                <button
                  onClick={() => { setSelectedCategory(null); setAnswers({}) }}
                  className="text-[11px] text-electric hover:underline mt-0.5"
                >
                  {selectedCategory.name} · cambiar
                </button>
              )}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        )}

        {!result && <div className="laser-line-h mb-6 opacity-40" />}

        <AnimatePresence mode="wait">
          {result ? (
            /* ── Resultado ── */
            <ScoreResult
              key="result"
              {...result}
              projectName={projectName}
              onClose={() => { onClose(); navigate("/matrix") }}
            />

          ) : !selectedCategory ? (
            /* ── Paso 0: Selección de categoría ── */
            <motion.div
              key="category-select"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <LayoutGrid size={16} className="text-electric" />
                <p className="text-sm font-semibold text-white">¿Con qué criterios evaluar?</p>
              </div>

              {categories.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Cargando categorías...</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat)}
                      className={cn(
                        "w-full text-left px-4 py-3.5 rounded-xl border transition-all",
                        "bg-navy-800/60 border-navy-600 hover:border-electric/50 hover:bg-electric/5",
                        "group"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white group-hover:text-electric transition-colors">
                            {cat.name}
                            {cat.is_default && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-electric/20 text-electric border border-electric/30">
                                Default
                              </span>
                            )}
                          </p>
                          {cat.description && (
                            <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-electric transition-colors flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

          ) : ordered.length === 0 ? (
            /* ── Sin preguntas en la categoría ── */
            <motion.div
              key="no-questions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <p className="text-slate-400 text-sm">Esta categoría no tiene preguntas activas.</p>
              <button
                onClick={() => setSelectedCategory(null)}
                className="mt-3 text-electric text-sm hover:underline"
              >
                Elegir otra categoría
              </button>
            </motion.div>

          ) : (
            /* ── Preguntas ── */
            <QuestionStep
              key={step}
              question={current.text}
              axis={current.axis as "impact" | "effort"}
              current={step + 1}
              total={ordered.length}
              value={answers[current.id] ?? 0}
              onChange={handleAnswer}
            />
          )}
        </AnimatePresence>

        {/* Notas — aparece en el último paso antes de enviar */}
        {!result && selectedCategory && ordered.length > 0 && isLast && answers[current.id] !== undefined && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4"
          >
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales (opcional)..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all resize-none"
            />
          </motion.div>
        )}

        {/* Navegación — solo cuando hay categoría y preguntas */}
        {!result && selectedCategory && ordered.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-navy-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <button
              onClick={handleNext}
              disabled={answers[current.id] === undefined || loading}
              className={cn(
                "flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all",
                "bg-electric text-white hover:bg-electric-bright shadow-glow-blue",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLast ? (
                <><CheckIcon size={16} /><span>Calcular resultado</span></>
              ) : (
                <><span>Siguiente</span><ChevronRight size={16} /></>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// Ícono inline para no importar otro
function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
