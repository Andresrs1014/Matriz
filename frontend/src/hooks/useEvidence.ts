// frontend/src/hooks/useEvidence.ts
import { useCallback, useState } from "react"
import api from "@/lib/api"
import type { Evidence } from "@/types/evidence"

export function useEvidence() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listEvidence = useCallback(async (projectId: number): Promise<Evidence[]> => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get(`/projects/${projectId}/evidence`)
      return data
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "Error al cargar evidencias."
      setError(msg)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const uploadEvidence = useCallback(
    async (projectId: number, file: File, description?: string | null, onProgress?: (percent: number) => void): Promise<Evidence | null> => {
      setLoading(true)
      setError(null)
      try {
        const form = new FormData()
        form.append("file", file)
        if (description) form.append("description", description)
        const { data } = await api.post(`/projects/${projectId}/evidence`, form, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => {
            if (e.total && onProgress) {
              onProgress(Math.round((e.loaded / e.total) * 100))
            }
          },
        })
        return data
      } catch (err: any) {
        const msg = err?.response?.data?.detail ?? "Error al subir evidencia."
        setError(msg)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const deleteEvidence = useCallback(async (projectId: number, evidenceId: number): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      await api.delete(`/projects/${projectId}/evidence/${evidenceId}`)
      return true
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "Error al eliminar evidencia."
      setError(msg)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const downloadEvidence = useCallback((projectId: number, evidenceId: number): string => {
    return `${api.defaults.baseURL}/projects/${projectId}/evidence/${evidenceId}/download`
  }, [])

  return {
    loading,
    error,
    listEvidence,
    uploadEvidence,
    deleteEvidence,
    downloadEvidence,
    clearError: () => setError(null),
  }
}
