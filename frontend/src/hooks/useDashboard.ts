import { useState, useEffect, useCallback } from "react"
import api from "@/lib/api"
import type { DashboardStats, QuadrantSummary } from "@/types/matrix"

export function useDashboard() {
  const [stats,   setStats]   = useState<DashboardStats | null>(null)
  const [summary, setSummary] = useState<QuadrantSummary[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, summaryRes] = await Promise.all([
        api.get<DashboardStats>("/dashboard/stats"),
        api.get<QuadrantSummary[]>("/dashboard/quadrant-summary"),
      ])
      setStats(statsRes.data)
      setSummary(summaryRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return { stats, summary, loading, refetch: fetchAll }
}
