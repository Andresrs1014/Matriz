import { useState, useCallback } from "react"
import api from "@/lib/api"
import type { ROIRead, ROIParte1Input, ROIParte2Input, ROIPlotPoint } from "@/types/roi"


export function useROI(projectId: number) {
  const [roiData,    setRoiData]    = useState<ROIRead | null>(null)
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

  const submitROIParte1 = useCallback(async (data: ROIParte1Input): Promise<ROIRead> => {
    setSubmitting(true)
    try {
      const res = await api.post<ROIRead>(`/roi/${projectId}/parte1`, data)
      setRoiData(res.data)
      return res.data
    } finally {
      setSubmitting(false)
    }
  }, [projectId])

  const submitROIParte2 = useCallback(async (data: ROIParte2Input): Promise<ROIRead> => {
    setSubmitting(true)
    try {
      const res = await api.patch<ROIRead>(`/roi/${projectId}/parte2`, data)
      setRoiData(res.data)
      return res.data
    } finally {
      setSubmitting(false)
    }
  }, [projectId])

  return { roiData, loading, submitting, fetchROI, submitROIParte1, submitROIParte2 }
}


export function useROIPlot() {
  const [roiPlotPoints, setRoiPlotPoints] = useState<ROIPlotPoint[]>([])
  const [loading,       setLoading]       = useState(false)

  const fetchROIPlot = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ROIPlotPoint[]>("/roi/plot/all")
      setRoiPlotPoints(res.data)
    } catch {
      setRoiPlotPoints([])
    } finally {
      setLoading(false)
    }
  }, [])

  return { roiPlotPoints, loading, fetchROIPlot }
}
