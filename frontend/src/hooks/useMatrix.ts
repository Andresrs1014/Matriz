import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
import { useProjectStore } from "@/store/projectStore"
import type { MatrixQuestion, EvaluationSubmit, EvaluationRead, MatrixPlotPoint } from "@/types/matrix"

export function useMatrix() {
  const { plotPoints, setPlotPoints, updatePlotPoint } = useProjectStore()
  const [questions, setQuestions] = useState<MatrixQuestion[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const fetchQuestions = useCallback(async () => {
    try {
      const { data } = await api.get<MatrixQuestion[]>("/matrix/questions")
      setQuestions(data)
    } catch {
      setError("No se pudieron cargar las preguntas.")
    }
  }, [])

  const fetchPlotPoints = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<MatrixPlotPoint[]>("/matrix/plot")
      setPlotPoints(data)
    } catch {
      setError("No se pudo cargar la matriz.")
    } finally {
      setLoading(false)
    }
  }, [setPlotPoints])

  useEffect(() => {
    fetchQuestions()
    fetchPlotPoints()
  }, [fetchQuestions, fetchPlotPoints])

  async function submitEvaluation(projectId: number, payload: EvaluationSubmit): Promise<EvaluationRead | null> {
    try {
      const { data } = await api.post<EvaluationRead>(`/matrix/evaluate/${projectId}`, payload)
      // Actualiza el punto en la matriz en tiempo real
      updatePlotPoint({
        project_id:    projectId,
        project_title: "",   // se actualiza en el fetch siguiente
        impact_score:  data.impact_score,
        effort_score:  data.effort_score,
        quadrant:      data.quadrant,
        evaluation_id: data.id,
        evaluated_at:  data.created_at,
      })
      await fetchPlotPoints()  // refresca con título correcto
      return data
    } catch {
      setError("No se pudo guardar la evaluación.")
      return null
    }
  }

  return { questions, plotPoints, loading, error, fetchPlotPoints, submitEvaluation }
}
