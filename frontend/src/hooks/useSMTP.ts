import { useCallback, useEffect, useState } from "react"
import api from "@/lib/api"
import type { SMTPConfig, SMTPConfigUpsert } from "@/types/smtp"

function detailMessage(e: unknown): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof d === "string") return d
  if (Array.isArray(d)) return d.map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x))).join(", ")
  return "Error inesperado."
}

/** GET `/settings/smtp` — 404 → `data: null` sin tratarlo como error de red. */
export function useSMTPConfig() {
  const [data, setData] = useState<SMTPConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: row } = await api.get<SMTPConfig>("/settings/smtp")
      setData(row)
      return row
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        setData(null)
        return null
      }
      const msg = detailMessage(e)
      setError(msg)
      setData(null)
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

/** PUT `/settings/smtp` — tras guardar, llamar `refetch` de `useSMTPConfig`. */
export function useUpsertSMTP() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(async (payload: SMTPConfigUpsert, onSettled?: () => void | Promise<void>) => {
    setIsPending(true)
    setError(null)
    try {
      const { data } = await api.put<SMTPConfig>("/settings/smtp", payload)
      await onSettled?.()
      return data
    } catch (e: unknown) {
      const msg = detailMessage(e)
      setError(msg)
      return null
    } finally {
      setIsPending(false)
    }
  }, [])

  return { mutate, isPending, error }
}

/** POST `/settings/smtp/test` */
export function useTestSMTP() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(async () => {
    setIsPending(true)
    setError(null)
    try {
      const { data } = await api.post<{ ok: boolean; sent_to: string }>("/settings/smtp/test")
      return data
    } catch (e: unknown) {
      const msg = detailMessage(e)
      setError(msg)
      return null
    } finally {
      setIsPending(false)
    }
  }, [])

  return { mutate, isPending, error }
}
