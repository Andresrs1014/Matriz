// frontend/src/components/evaluation/EvaluationWizard.tsx
import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, ChevronRight, ChevronLeft, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import QuestionStep from "./QuestionStep"
import ScoreResult from "./ScoreResult"
import { useMatrix } from "@/hooks/useMatrix"
import api from "@/lib/api"
import type { CategoryRead, MatrixQuestion } from "@/types/matrix"
import type { QuadrantKey } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface EvaluationWizardProps {
  projectId: number
  projectName: string
  onClose: () => void
}

interface EvalResult {
  impactScore: number
  effortScore: number
  quadrant: QuadrantKey
}

// Pregunta "virtual" construida desde ProjectQuestion (asignadas por superadmin)
interface VirtualQuestion {
  id: number
  text: string
  axis: "impact" | "effort"
  weight: number
  order: number
  category_id: number | null
  source: "project" | "global"
  source_question_id: number | null
}

export default function EvaluationWizard({ projectId, projectName, onClose }: EvaluationWizardProps) {
  const navigate = useNavigate()
  const { categories, questions, fetchQuestions, submitEvaluation } = useMatrix()

  const [mode, setMode] = useState<"select" | "project_questions" | "evaluating">("select")
  const [selectedCategory, setSelectedCategory] = useState<CategoryRead | null>(null)
  const [projectQuestions, setProjectQuestions] = useState<VirtualQuestion[]>([])
  const [loadingPQ, setLoadingPQ] = useState(true)
  const [hasPQ, setHasPQ] = useState(false)

  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [step, setStep] = useState(0)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EvalResult | null>(null)

  // Cargar preguntas asignadas por el superadmin al proyecto
  useEffect(() => {
    async function loadProjectQuestions() {
      try {
        const { data } = await api.get(`/projects/${projectId}/questions`)
        if (data && data.length > 0) {
          // Convertir ProjectQuestion a VirtualQuestion
          // Las preguntas asignadas se dividen en impacto/esfuerzo por índice (mitad y mitad)
          // El superadmin no distingue ejes, así que las primeras son impacto y las segundas esfuerzo
          const half = Math.ceil(data.length / 2)
          const virtual: VirtualQuestion[] = data.map((pq: any, i: number) => ({
            id: pq.id,
            text: pq.question_text,
            axis: i < half ? "impact" : "effort",
            weight: 1,
            order: i,
            category_id: null,
            source: "project",
            source_question_id: pq.source_question_id ?? null,
          }))
          setProjectQuestions(virtual)
          setHasPQ(true)
        }
      } catch {
        setHasPQ(false)
      } finally {
        setLoadingPQ(false)
      }
    }
    loadProjectQuestions()
  }, [projectId])

  // Preguntas activas en el wizard (project o global según modo)
  const ordered: (MatrixQuestion | VirtualQuestion)[] = mode === "project_questions"
    ? [...projectQuestions.filter((q) => q.axis === "impact").sort((a, b) => a.order - b.order),
       ...projectQuestions.filter((q) => q.axis === "effort").sort((a, b) => a.order - b.order)]
    : [...questions.filter((q) => q.axis === "impact").sort((a, b) => a.order - b.order),
       ...questions.filter((q) => q.axis === "effort").sort((a, b) => a.order - b.order)]

  const current = ordered[step]
  const isLast = step === ordered.length - 1

  async function handleCategorySelect(category: CategoryRead) {
    setSelectedCategory(category)
    setAnswers({})
    setStep(0)
    setMode("evaluating")
    await fetchQuestions(category.id)
  }

  function handleUseProjectQuestions() {
    setAnswers({})
    setStep(0)
    setMode("project_questions")
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
    setLoading(true)

    const responses = ordered.map((q) => ({
      question_id: q.id,
      value: answers[q.id] as 1 | 2 | 3 | 4 | 5,
    }))

    // Si usamos preguntas del proyecto, necesitamos mapear a IDs de MatrixQuestion
    // para que el backend pueda calcular scores. Las PQ son "virtuales" sin MatrixQuestion ID.
    // Solución: si mode es project_questions, enviamos sin category_id y el backend
    // usa los question_ids de las preguntas globales que el superadmin seleccionó.
    // Para PQ custom (sin source_question_id), usamos una categoría default.
    let categoryId: number | null = selectedCategory?.id ?? null

    // Si las preguntas son del proyecto con source_question_id, usar esos IDs reales
    let finalResponses = responses
    if (mode === "project_questions") {
      const mapped = ordered
        .map((q: any) => ({
          question_id: q.source_question_id as number | null,
          value: answers[q.id] as 1 | 2 | 3 | 4 | 5,
        }))
        .filter((r) => r.question_id !== null) as { question_id: number; value: 1|2|3|4|5 }[]

      if (mapped.length === 0) {
        alert(
          "Las preguntas asignadas por el superadmin son preguntas personalizadas (texto libre) " +
          "y no pueden ser puntuadas con el sistema de impacto/esfuerzo.\n\n" +
          "Por favor, usa un paquete de preguntas global para evaluar este proyecto."
        )
        setLoading(false)
        return
      }

      finalResponses = mapped
      categoryId = null
    }

    const evaluation = await submitEvaluation(projectId, {
      responses: finalResponses,
      category_id: categoryId ?? undefined,
      notes: notes || undefined,
    })

    if (evaluation) {
      setResult({
        impactScore: evaluation.impact_score,
        effortScore: evaluation.effort_score,
        quadrant: evaluation.quadrant as QuadrantKey,
      })
    } else {
      alert(
        "No se pudo calcular el resultado. Verifica que las preguntas asignadas " +
        "pertenezcan a un paquete activo y vuelve a intentarlo."
      )
    }
    setLoading(false)
  }

  // Si evaluación completada con éxito, marcar proyecto como evaluado automáticamente
  useEffect(() => {
    if (result) {
      api.post(`/projects/${projectId}/marcar-evaluado`).catch(() => {
        // Si ya estaba evaluado o no está en el estado correcto, no es error crítico
      })
    }
  }, [result])

  const showingEvaluating = mode === "evaluating" || mode === "project_questions"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 shrink-0">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Evaluando proyecto</p>
            <h2 className="text-sm font-semibold text-white mt-0.5 truncate max-w-xs">{projectName}</h2>
            {mode === "project_questions" && (
              <span className="text-[10px] text-amber-400 font-medium">
                Usando preguntas del superadmin
              </span>
            )}
            {selectedCategory && mode === "evaluating" && (
              <button
                onClick={() => { setSelectedCategory(null); setMode("select"); setAnswers({}) }}
                className="text-[11px] text-electric hover:underline mt-0.5 block"
              >
                {selectedCategory.name} · cambiar
              </button>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {result ? (
            // Resultado
            <ScoreResult
              impactScore={result.impactScore}
              effortScore={result.effortScore}
              quadrant={result.quadrant}
              projectName={projectName}
              onClose={() => { onClose(); navigate("/matrix") }}
            />
          ) : !showingEvaluating ? (
            // Selección de modo
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-300">¿Con qué preguntas evaluar?</p>

              {/* Opción 1: preguntas del superadmin */}
              {loadingPQ ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando preguntas asignadas...
                </div>
              ) : hasPQ && (
                <button
                  onClick={handleUseProjectQuestions}
                  className="w-full text-left px-4 py-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-amber-400">
                      Preguntas del Superadmin
                    </span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                      {projectQuestions.length} preguntas
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Asignadas específicamente para este proyecto
                  </p>
                </button>
              )}

              {/* Separador */}
              {hasPQ && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-700/50" />
                  <span className="text-xs text-slate-600">o usa un paquete global</span>
                  <div className="flex-1 h-px bg-slate-700/50" />
                </div>
              )}

              {/* Opción 2: categorías globales */}
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Paquetes de preguntas</p>
              {categories.length === 0 ? (
                <p className="text-xs text-slate-600 italic">Cargando paquetes...</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat)}
                      className={cn(
                        "w-full text-left px-4 py-3.5 rounded-xl border transition-all",
                        "bg-navy-800/60 border-navy-600 hover:border-electric/50 hover:bg-electric/5"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{cat.name}</span>
                        {cat.is_default && (
                          <span className="text-[10px] bg-electric/10 text-electric px-1.5 py-0.5 rounded border border-electric/20">
                            Default
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-xs text-slate-400 mt-1">{cat.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : ordered.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              <p>Esta categoría no tiene preguntas activas.</p>
              <button
                onClick={() => { setSelectedCategory(null); setMode("select") }}
                className="mt-3 text-electric text-sm hover:underline"
              >
                Elegir otra
              </button>
            </div>
          ) : (
            // Preguntas
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <QuestionStep
                  question={current.text}
                  axis={current.axis}
                  current={step}
                  total={ordered.length}
                  value={answers[current.id]}
                  onChange={handleAnswer}
                />
              </motion.div>
            </AnimatePresence>
          )}

          {/* Notas — último paso */}
          {!result && showingEvaluating && ordered.length > 0 && isLast && answers[current.id] !== undefined && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales (opcional)..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all resize-none"
              />
            </motion.div>
          )}
        </div>

        {/* Navegación */}
        {!result && showingEvaluating && ordered.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50 shrink-0">
            <button
              onClick={() => step === 0 ? (() => { setMode("select"); setAnswers({}) })() : setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-navy-800 transition-all"
            >
              <ChevronLeft size={16} /> {step === 0 ? "Cambiar paquete" : "Anterior"}
            </button>
            <span className="text-xs text-slate-600">{step + 1} / {ordered.length}</span>
            <button
              onClick={handleNext}
              disabled={answers[current.id] === undefined || loading}
              className={cn(
                "flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all",
                "bg-electric text-white hover:bg-electric-bright shadow-glow-blue",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {loading
                ? <Loader2 size={16} className="animate-spin" />
                : isLast
                  ? <><CheckIcon size={16} /><span>Calcular resultado</span></>
                  : <><span>Siguiente</span><ChevronRight size={16} /></>
              }
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
