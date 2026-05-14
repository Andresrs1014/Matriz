import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
import type { DashboardStats, QuadrantSummary } from "@/types/matrix"
import type { CatalogRow } from "@/types/catalog"

export function useDashboard(areaId?: number) {
  const [stats,   setStats]   = useState<DashboardStats | null>(null)
  const [summary, setSummary] = useState<QuadrantSummary[]>([])
  const [areas, setAreas] = useState<CatalogRow[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = areaId ? `?area_id=${areaId}` : ""
      const [statsRes, summaryRes] = await Promise.all([
        api.get<DashboardStats>(`/dashboard/stats${params}`),
        api.get<QuadrantSummary[]>(`/dashboard/quadrant-summary${params}`),
      ])
      setStats(statsRes.data)
      setSummary(summaryRes.data)
    } finally {
      setLoading(false)
    }
  }, [areaId])

  const fetchAreas = useCallback(async () => {
    try {
      const res = await api.get<CatalogRow[]>("/catalog/areas")
      setAreas(res.data)
    } catch {
      setAreas([])
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchAreas() }, [fetchAreas])

  return { stats, summary, areas, loading, refetch: fetchAll }
}
