import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
import { useProjectStore } from "@/store/projectStore"
import type { Project, ProjectCreate } from "@/types/project"

export function useProjects() {
  const { projects, setProjects, addProject } = useProjectStore()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<Project[]>("/projects")
      setProjects(data)
    } catch {
      setError("No se pudieron cargar los proyectos.")
    } finally {
      setLoading(false)
    }
  }, [setProjects])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  async function createProject(payload: ProjectCreate): Promise<Project | null> {
    try {
      const { data } = await api.post<Project>("/projects", payload)
      addProject(data)
      return data
    } catch {
      setError("No se pudo crear el proyecto.")
      return null
    }
  }

  async function deleteProject(id: number): Promise<boolean> {
    try {
      await api.delete(`/projects/${id}`)
      setProjects(projects.filter((p) => p.id !== id))
      return true
    } catch {
      setError("No se pudo eliminar el proyecto.")
      return false
    }
  }

  return { projects, loading, error, fetchProjects, createProject, deleteProject }
}
