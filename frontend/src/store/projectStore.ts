import { create } from "zustand"
import type { Project } from "@/types/project"
import type { MatrixPlotPoint } from "@/types/matrix"

interface ProjectStore {
  projects:   Project[]
  plotPoints: MatrixPlotPoint[]
  wsConnected: boolean

  setProjects:   (projects: Project[]) => void
  addProject:    (project: Project) => void
  setPlotPoints: (points: MatrixPlotPoint[]) => void
  updatePlotPoint: (point: MatrixPlotPoint) => void
  setWsConnected: (connected: boolean) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects:    [],
  plotPoints:  [],
  wsConnected: false,

  setProjects:   (projects) => set({ projects }),
  addProject:    (project)  => set((s) => ({ projects: [project, ...s.projects] })),
  setPlotPoints: (points)   => set({ plotPoints: points }),

  updatePlotPoint: (point) =>
    set((s) => ({
      plotPoints: s.plotPoints.some((p) => p.project_id === point.project_id)
        ? s.plotPoints.map((p) => (p.project_id === point.project_id ? point : p))
        : [...s.plotPoints, point],
    })),

  setWsConnected: (connected) => set({ wsConnected: connected }),
}))
