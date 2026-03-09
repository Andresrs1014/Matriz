import { useState, useCallback } from "react"
import api from "@/lib/api"
import type { ROIRead, ROIParte1Input, ROIParte2Input, ROIPlotPoint } from "@/types/roi"

export function useROI(projectId: number) {
  const [roi,          setRoi]          = useState<ROIRead | null>(null)
  const [history,      setHistory]      = useState<ROIRead[]>([])
  const [loading,      setLoading]      = useState(false)
  const [loadingHist,  setLoadingHist]  = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const fetchROI = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<ROIRead>(`/roi/${projectId}`)
      setRoi(res.data)
    } catch {
      setRoi(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const fetchHistory = useCallback(async () => {
    setLoadingHist(true)
    try {
      const res = await api.get<ROIRead[]>(`/roi/history/${projectId}`)
      setHistory(res.data)
    } catch {
      setHistory([])
    } finally {
      setLoadingHist(false)
    }
  }, [projectId])

  const submitROIParte1 = useCallback(async (data: ROIParte1Input) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post<ROIRead>(`/roi/${projectId}/parte1`, data)
      setRoi(res.data)
      return res.data
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al guardar Parte 1")
      throw e
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const submitROIParte2 = useCallback(async (data: ROIParte2Input) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.patch<ROIRead>(`/roi/${projectId}/parte2`, data)
      setRoi(res.data)
      return res.data
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al guardar Parte 2")
      throw e
    } finally {
      setLoading(false)
    }
  }, [projectId])

  return { roi, history, loading, loadingHist, error, fetchROI, fetchHistory, submitROIParte1, submitROIParte2 }
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
