import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query"

import api from "@/lib/api"
import type { ChecklistItem, ProjectProgress, ProjectTask, TaskCreate, TaskUpdate } from "@/types/task"

function invalidateProjectTasks(qc: ReturnType<typeof useQueryClient>, projectId: number) {
  void qc.invalidateQueries({ queryKey: ["tasks", projectId] })
  void qc.invalidateQueries({ queryKey: ["progress", projectId] })
}

export function useTasks(projectId: number | undefined): UseQueryResult<ProjectTask[], Error> {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async () => {
      const { data } = await api.get<ProjectTask[]>(`/projects/${projectId}/tasks`)
      return data
    },
    enabled: projectId != null && projectId > 0,
  })
}

export function useProjectProgress(
  projectId: number | undefined,
): UseQueryResult<ProjectProgress, Error> {
  return useQuery({
    queryKey: ["progress", projectId],
    queryFn: async () => {
      const { data } = await api.get<ProjectProgress>(
        `/projects/${projectId}/tasks/progress`,
      )
      return data
    },
    enabled: projectId != null && projectId > 0,
  })
}

export function useCreateTask(projectId: number): UseMutationResult<
  ProjectTask,
  Error,
  TaskCreate
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: TaskCreate) => {
      const { data } = await api.post<ProjectTask>(`/projects/${projectId}/tasks`, payload)
      return data
    },
    onSuccess: () => invalidateProjectTasks(qc, projectId),
  })
}

export function useUpdateTask(projectId: number): UseMutationResult<
  ProjectTask,
  Error,
  { taskId: number; payload: TaskUpdate }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, payload }) => {
      const { data } = await api.patch<ProjectTask>(
        `/projects/${projectId}/tasks/${taskId}`,
        payload,
      )
      return data
    },
    onSuccess: () => invalidateProjectTasks(qc, projectId),
  })
}

export function useCompleteTask(projectId: number): UseMutationResult<
  ProjectTask,
  Error,
  number
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: number) => {
      const { data } = await api.post<ProjectTask>(
        `/projects/${projectId}/tasks/${taskId}/complete`,
      )
      return data
    },
    onSuccess: () => invalidateProjectTasks(qc, projectId),
  })
}

export function useReopenTask(projectId: number): UseMutationResult<
  ProjectTask,
  Error,
  number
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: number) => {
      const { data } = await api.post<ProjectTask>(
        `/projects/${projectId}/tasks/${taskId}/reopen`,
      )
      return data
    },
    onSuccess: () => invalidateProjectTasks(qc, projectId),
  })
}

export function useDeleteTask(projectId: number): UseMutationResult<void, Error, number> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: number) => {
      await api.delete(`/projects/${projectId}/tasks/${taskId}`)
    },
    onSuccess: () => invalidateProjectTasks(qc, projectId),
  })
}

export function useUpdateChecklistItem(projectId: number): UseMutationResult<
  ChecklistItem,
  Error,
  { taskId: number; itemId: number; is_done?: boolean; text?: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, itemId, ...patch }) => {
      const { data } = await api.patch<ChecklistItem>(
        `/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`,
        patch,
      )
      return data
    },
    onSuccess: () => invalidateProjectTasks(qc, projectId),
  })
}

export function useAddChecklistItem(projectId: number): UseMutationResult<
  ChecklistItem,
  Error,
  { taskId: number; text: string; sort_order?: number }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, text, sort_order }) => {
      const { data } = await api.post<ChecklistItem>(
        `/projects/${projectId}/tasks/${taskId}/checklist`,
        { text, sort_order: sort_order ?? 0 },
      )
      return data
    },
    onSuccess: () => invalidateProjectTasks(qc, projectId),
  })
}

export function useDeleteChecklistItem(projectId: number): UseMutationResult<
  void,
  Error,
  { taskId: number; itemId: number }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, itemId }) => {
      await api.delete(`/projects/${projectId}/tasks/${taskId}/checklist/${itemId}`)
    },
    onSuccess: () => invalidateProjectTasks(qc, projectId),
  })
}
