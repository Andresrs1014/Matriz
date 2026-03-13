// frontend/src/components/evaluation/EvaluationWizard.tsx
import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, ChevronRight, ChevronLeft, Loader2, AlertCircle } from "lucide-react"
import QuestionStep from "./QuestionStep"
import ScoreResult from "./ScoreResult"
import { useMatrix } from "@/hooks/useMatrix"
import api from "@/lib/api"
import type { QuadrantKey } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface EvalResult {
  impactScore: number
  effortScore: number
  quadrant: QuadrantKey
}

interface ProjectQuestion {
  id: number
  question_text: string
  source_question_id: number | null
}

// Adaptamos ProjectQuestion al shape que espera QuestionStep
function toWizardQuestion(pq: ProjectQuestion, index: number, total: number) {
  return {
    id: pq.id,
    text: pq.question_text,
    // axis visual: primera mitad impacto, segunda esfuerzo (solo para mostrar color)
    axis: index < Math.ceil(total / 2) ? "impact" : "effort",
    weight: 1,
    order: index,
    category_id: null,
  }
}

interface EvaluationWizardProps {
  projectId: number
  projectName: string
  onClose: () => void
}

export default function EvaluationWizard({ projectId, projectName, onClose }: EvaluationWizardProps) {
  const { submitEvaluation } = useMatrix()

  const [projectQuestions, setProjectQuestions] = useState<ProjectQuestion[]>([])
  const [loadingPQ, setLoadingPQ] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [step, setStep] = useState(0)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EvalResult | null>(null)

  useEffect(() => {
    async function loadProjectQuestions() {
      try {
        const { data } = await api.get<ProjectQuestion[]>(`/projects/${projectId}/questions`)
        if (!data || data.length === 0) {
          setLoadError("Este proyecto no tiene preguntas asignadas. El superadmin debe aprobar el proyecto primero.")
        } else {
          setProjectQuestions(data)
        }
      } catch {
        setLoadError("Error al cargar las preguntas del proyecto.")
      } finally {
        setLoadingPQ(false)
      }
    }
    loadProjectQuestions()
  }, [projectId])

  const wizardQuestions = projectQuestions.map((pq, i) =>
    toWizardQuestion(pq, i, projectQuestions.length)
  )
  const current = wizardQuestions[step]
  const isLast = step === wizardQuestions.length - 1

  function handleAnswer(value: number) {
    setAnswers((prev) => ({ ...prev, [current.id]: value }))
  }

  async function handleSubmit() {
    setLoading(true)
    // Usamos el ID real de la ProjectQuestion para que el backend mapee correctamente
    const responses = projectQuestions.map((pq) => ({
      question_id: pq.source_question_id ?? pq.id,
      value: (answers[pq.id] ?? 3) as 1 | 2 | 3 | 4 | 5,
    }))

    const evaluation = await submitEvaluation(projectId, {
      responses,
      notes: notes || undefined,
    })

    if (evaluation) {
      setResult({
        impactScore: evaluation.impact_score,
        effortScore: evaluation.effort_score,
        quadrant: evaluation.quadrant as QuadrantKey,
      })
      // Marcar proyecto como evaluado automáticamente
      await api.post(`/projects/${projectId}/marcar-evaluado`).catch(() => {})
    }
    setLoading(false)
  }

  function handleNext() {
    if (answers[current.id] === undefined) return
    if (!isLast) {
      setStep((s) => s + 1)
    } else {
      handleSubmit()
    }
  }

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
            {!loadingPQ && !loadError && (
              <span className="text-[10px] text-amber-400 font-medium">
                {projectQuestions.length} preguntas asignadas
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Cargando */}
          {loadingPQ && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-electric" />
              <p className="text-sm text-slate-500">Cargando preguntas del proyecto...</p>
            </div>
          )}

          {/* Error al cargar */}
          {!loadingPQ && loadError && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <p className="text-sm text-slate-300">{loadError}</p>
              <button onClick={onClose}
                className="mt-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 transition-all">
                Cerrar
              </button>
            </div>
          )}

          {/* Resultado */}
          {!loadingPQ && !loadError && result && (
            <ScoreResult
              impactScore={result.impactScore}
              effortScore={result.effortScore}
              quadrant={result.quadrant}
              projectName={projectName}
              onClose={onClose}
            />
          )}

          {/* Preguntas */}
          {!loadingPQ && !loadError && !result && wizardQuestions.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <QuestionStep
                  question={current.text}
                  axis={current.axis as "impact" | "effort"}
                  current={step + 1}
                  total={wizardQuestions.length}
                  value={answers[current.id]}
                  onChange={handleAnswer}
                />
              </motion.div>
            </AnimatePresence>
          )}

          {/* Notas en el último paso */}
          {!loadingPQ && !loadError && !result && isLast && answers[current?.id] !== undefined && (
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
        {!loadingPQ && !loadError && !result && wizardQuestions.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50 shrink-0">
            <button
              onClick={() => step === 0 ? onClose() : setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-navy-800 transition-all"
            >
              <ChevronLeft size={16} />
              {step === 0 ? "Cancelar" : "Anterior"}
            </button>
            <span className="text-xs text-slate-600">{step + 1} / {wizardQuestions.length}</span>
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
                <Loader2 size={16} className="animate-spin" />
              ) : isLast ? (
                <>
                  <CheckIcon size={16} />
                  <span>Calcular resultado</span>
                </>
              ) : (
                <>
                  <span>Siguiente</span>
                  <ChevronRight size={16} />
                </>
              )}
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
