import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
import type { Category, Question, CategoryCreate, QuestionCreate } from "@/types/settings"

export function useSettings() {
  const [categories, setCategories] = useState<Category[]>([])
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [catRes, qRes] = await Promise.all([
        api.get<Category[]>("/settings/categories"),
        api.get<Question[]>("/settings/questions"),
      ])
      setCategories(catRes.data)
      setQuestions(qRes.data)
    } catch {
      setError("No se pudo cargar la configuración.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function createCategory(payload: CategoryCreate): Promise<Category | null> {
    try {
      const { data } = await api.post<Category>("/settings/categories", payload)
      setCategories((prev) => [...prev, data])
      return data
    } catch { setError("No se pudo crear la categoría."); return null }
  }

  async function updateCategory(id: number, payload: Partial<CategoryCreate & { is_active: boolean }>): Promise<void> {
    try {
      const { data } = await api.put<Category>(`/settings/categories/${id}`, payload)
      setCategories((prev) => prev.map((c) => c.id === id ? data : c))
    } catch { setError("No se pudo actualizar la categoría.") }
  }

  async function deleteCategory(id: number): Promise<void> {
    try {
      await api.delete(`/settings/categories/${id}`)
      setCategories((prev) => prev.filter((c) => c.id !== id))
      setQuestions((prev) => prev.filter((q) => q.category_id !== id))
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "No se pudo eliminar la categoría.")
    }
  }

  async function createQuestion(payload: QuestionCreate): Promise<Question | null> {
    try {
      const { data } = await api.post<Question>("/settings/questions", payload)
      setQuestions((prev) => [...prev, data])
      await fetchAll() // refresca conteos
      return data
    } catch { setError("No se pudo crear la pregunta."); return null }
  }

  async function updateQuestion(id: number, payload: Partial<Question>): Promise<void> {
    try {
      const { data } = await api.put<Question>(`/settings/questions/${id}`, payload)
      setQuestions((prev) => prev.map((q) => q.id === id ? data : q))
    } catch { setError("No se pudo actualizar la pregunta.") }
  }

  async function deleteQuestion(id: number): Promise<void> {
    try {
      await api.delete(`/settings/questions/${id}`)
      setQuestions((prev) => prev.filter((q) => q.id !== id))
      await fetchAll()
    } catch { setError("No se pudo eliminar la pregunta.") }
  }

  return {
    categories, questions, loading, error,
    createCategory, updateCategory, deleteCategory,
    createQuestion, updateQuestion, deleteQuestion,
    refetch: fetchAll,
  }
}
