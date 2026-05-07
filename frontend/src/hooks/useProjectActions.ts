// frontend/src/hooks/useProjectActions.ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import api from "@/lib/api"
import { useProjectStore } from "@/store/projectStore"
import type {
  SuperaprobacionPayload,
  SalarioPayload,
  DatosOperacionalesPayload,
  Project,
  ProjectQuestion,
} from "@/types/project"

export function useProjectActions() {
  const queryClient = useQueryClient()
  const { setProjects, projects } = useProjectStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function _updateLocal(updated: Project) {
    setProjects(projects.map((p) => (p.id === updated.id ? updated : p)))
  }

  async function exec<T>(fn: () => Promise<T>): Promise<T | null> {
    setLoading(true)
    setError(null)
    try {
      return await fn()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Error inesperado.")
      return null
    } finally {
      setLoading(false)
    }
  }

  // Paso 1 — Admin escala al superadmin
  async function escalar(projectId: number) {
    return exec(async () => {
      const { data } = await api.post<Project>(`/projects/${projectId}/escalar`)
      _updateLocal(data)
      return data
    })
  }

  // Paso 2 — Superadmin aprueba + asigna preguntas
  async function superaprobar(projectId: number, payload: SuperaprobacionPayload) {
    return exec(async () => {
      const { data } = await api.post<Project>(`/projects/${projectId}/superaprobar`, payload)
      _updateLocal(data)
      return data
    })
  }

  // Paso 3 — Admin inicia evaluación
  async function iniciarEvaluacion(projectId: number) {
    return exec(async () => {
      const { data } = await api.post<Project>(`/projects/${projectId}/iniciar-evaluacion`)
      _updateLocal(data)
      return data
    })
  }

  // Paso 4 — Admin marca evaluado
  async function marcarEvaluado(projectId: number) {
    return exec(async () => {
      const { data } = await api.post<Project>(`/projects/${projectId}/marcar-evaluado`)
      _updateLocal(data)
      return data
    })
  }

  // Paso 5 — Superadmin provee salario
  async function proveerSalario(projectId: number, payload: SalarioPayload) {
    return exec(async () => {
      const { data } = await api.post<Project>(`/projects/${projectId}/proveer-salario`, payload)
      _updateLocal(data)
      return data
    })
  }

  // Paso 6 — Admin completa datos operacionales → dispara cálculo ROI y cierra flujo
  async function completarROI(projectId: number, payload: DatosOperacionalesPayload) {
    return exec(async () => {
      const { data } = await api.post<Project>(`/projects/${projectId}/completar-roi`, payload)
      _updateLocal(data)
      return data
    })
  }

  // Rechazar en cualquier etapa
  async function rechazar(projectId: number) {
    return exec(async () => {
      const { data } = await api.post<Project>(`/projects/${projectId}/rechazar`)
      _updateLocal(data)
      return data
    })
  }

  /** Superadmin: marca ejecución por área de Desarrollo (no cambia el estado del flujo). */
  async function assignToDev(projectId: number) {
    return exec(async () => {
      const { data } = await api.post<Project>(`/projects/${projectId}/assign-to-dev`)
      _updateLocal(data)
      return data
    })
  }

  async function unassignFromDev(projectId: number) {
    return exec(async () => {
      const { data } = await api.delete<Project>(`/projects/${projectId}/assign-to-dev`)
      _updateLocal(data)
      return data
    })
  }

  // Obtener preguntas asignadas al proyecto
  async function getProjectQuestions(projectId: number): Promise<ProjectQuestion[]> {
    const result = await exec(async () => {
      const { data } = await api.get<ProjectQuestion[]>(`/projects/${projectId}/questions`)
      return data
    })
    return result ?? []
  }

  const assignArea = useMutation({
    mutationFn: ({ projectId, areaId }: { projectId: number; areaId: number }) =>
      api.post<Project>(`/projects/${projectId}/assign-area`, { area_id: areaId }).then((r) => r.data),
    onSuccess: (_data, { projectId }) => {
      _updateLocal(_data)
      void queryClient.invalidateQueries({ queryKey: ["projects"] })
      window.dispatchEvent(
        new CustomEvent("matriz:project-data-stale", { detail: { projectId } }),
      )
    },
  })

  return {
    loading, error,
    escalar, superaprobar, iniciarEvaluacion,
    marcarEvaluado, proveerSalario, completarROI,
    rechazar, assignToDev, unassignFromDev, getProjectQuestions,
    assignArea: assignArea.mutateAsync,
    assignAreaPending: assignArea.isPending,
    assignAreaError: assignArea.error,
  }
}
