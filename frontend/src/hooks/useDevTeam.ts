import { useCallback, useEffect, useState } from "react"
import api from "@/lib/api"
import type { DevTeamMember } from "@/types/dev_team"

function detailMessage(e: unknown): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof d === "string") return d
  if (Array.isArray(d)) return d.map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x))).join(", ")
  return "Error inesperado."
}

/** GET `/settings/dev-team` — al montar carga una vez; usa `refetch` como “invalidar” tras mutaciones. */
export function useDevTeam() {
  const [data, setData] = useState<DevTeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: list } = await api.get<DevTeamMember[]>("/settings/dev-team")
      setData(list)
      return list
    } catch (e: unknown) {
      const msg = detailMessage(e)
      setError(msg)
      setData([])
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}

/** POST `/settings/dev-team` — pasar `refetch` de `useDevTeam` al terminar para sincronizar la lista. */
export function useAddDevTeamMember() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(
    async (userId: number, onSettled?: () => void | Promise<void>) => {
      setIsPending(true)
      setError(null)
      try {
        const { data } = await api.post<DevTeamMember>("/settings/dev-team", { user_id: userId })
        await onSettled?.()
        return data
      } catch (e: unknown) {
        const msg = detailMessage(e)
        setError(msg)
        return null
      } finally {
        setIsPending(false)
      }
    },
    []
  )

  return { mutate, isPending, error }
}

/** DELETE `/settings/dev-team/{user_id}` */
export function useRemoveDevTeamMember() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(async (userId: number, onSettled?: () => void | Promise<void>) => {
    setIsPending(true)
    setError(null)
    try {
      await api.delete(`/settings/dev-team/${userId}`)
      await onSettled?.()
      return true
    } catch (e: unknown) {
      const msg = detailMessage(e)
      setError(msg)
      return false
    } finally {
      setIsPending(false)
    }
  }, [])

  return { mutate, isPending, error }
}
