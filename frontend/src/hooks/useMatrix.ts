import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
import { useProjectStore } from "@/store/projectStore"
import type { CategoryRead, MatrixQuestion, EvaluationSubmit, EvaluationRead, MatrixPlotPoint } from "@/types/matrix"

export function useMatrix() {
  const { plotPoints, setPlotPoints, updatePlotPoint } = useProjectStore()
  const [categories, setCategories] = useState<CategoryRead[]>([])
  const [questions,  setQuestions]  = useState<MatrixQuestion[]>([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await api.get<CategoryRead[]>("/matrix/categories")
      setCategories(data)
    } catch {
      setError("No se pudieron cargar las categorías.")
    }
  }, [])

  const fetchQuestions = useCallback(async (categoryId?: number) => {
    try {
      const params = categoryId !== undefined ? { category_id: categoryId } : {}
      const { data } = await api.get<MatrixQuestion[]>("/matrix/questions", { params })
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
    fetchCategories()
    fetchPlotPoints()
  }, [fetchCategories, fetchPlotPoints])

  async function submitEvaluation(projectId: number, payload: EvaluationSubmit): Promise<EvaluationRead | null> {
    try {
      const { data } = await api.post<EvaluationRead>(`/matrix/evaluate/${projectId}`, payload)
      updatePlotPoint({
        project_id:    projectId,
        project_title: "",
        impact_score:  data.impact_score,
        effort_score:  data.effort_score,
        quadrant:      data.quadrant,
        evaluation_id: data.id,
        evaluated_at:  data.created_at,
      })
      await fetchPlotPoints()
      return data
    } catch {
      setError("No se pudo guardar la evaluación.")
      return null
    }
  }

  return { categories, questions, plotPoints, loading, error, fetchCategories, fetchQuestions, fetchPlotPoints, submitEvaluation }
}
