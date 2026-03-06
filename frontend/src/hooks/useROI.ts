import { useState, useCallback } from "react"
import api from "@/lib/api"
import type { ROIRead, ROIInput, ROIPlotPoint } from "@/types/roi"


export function useROI(projectId: number) {
  const [roiData,    setRoiData]    = useState<ROIRead | null>(null)
  const [roiHistory, setRoiHistory] = useState<ROIRead[]>([])
  const [loading,    setLoading]    = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchROI = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ROIRead | null>(`/roi/${projectId}`)
      setRoiData(res.data)
    } catch {
      setRoiData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const fetchROIHistory = useCallback(async () => {
    try {
      const res = await api.get<ROIRead[]>(`/roi/history/${projectId}`)
      setRoiHistory(res.data)
    } catch {
      setRoiHistory([])
    }
  }, [projectId])

  const submitROI = useCallback(async (input: ROIInput): Promise<ROIRead> => {
    setSubmitting(true)
    try {
      const res = await api.post<ROIRead>(`/roi/evaluate/${projectId}`, input)
      setRoiData(res.data)
      return res.data
    } finally {
      setSubmitting(false)
    }
  }, [projectId])

  return { roiData, roiHistory, loading, submitting, fetchROI, fetchROIHistory, submitROI }
}


export function useROIPlot() {
  const [roiPlotPoints, setRoiPlotPoints] = useState<ROIPlotPoint[]>([])
  const [loading,       setLoading]       = useState(false)

  const fetchROIPlot = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ROIPlotPoint[]>("/roi/plot")
      setRoiPlotPoints(res.data)
    } catch {
      setRoiPlotPoints([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { roiPlotPoints, loading, fetchROIPlot }
}
