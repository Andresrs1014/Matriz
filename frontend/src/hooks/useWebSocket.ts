import { useEffect, useRef, useCallback } from "react"
import { useProjectStore } from "@/store/projectStore"
import { useProjects } from "@/hooks/useProjects"
import { toast } from "@/store/toastStore"
import { WS_URL } from "@/lib/constants"

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const { setWsConnected } = useProjectStore()
  const { fetchProjects } = useProjects()

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data) as { event: string; data: any }
      console.log("[WS] mensaje recibido:", msg)

      switch (msg.event) {
        case "project.created":
          fetchProjects()
          toast.success(`Proyecto creado: "${msg.data?.title ?? "sin título"}"`)
          break

        case "evaluation_created":
          fetchProjects()
          toast.success(`Proyecto evaluado: cuadrante ${msg.data?.quadrant ?? ""}`)
          break

        case "project.webhook":
          fetchProjects()
          toast.info(`Proyecto sincronizado desde Microsoft Lists: "${msg.data?.title ?? ""}"`)
          break

        default:
          break
      }
    } catch {
      // mensaje no JSON — ignorar
    }
  }, [fetchProjects])

  useEffect(() => {
    const connect = () => {
      // ✅ Guard — no abrir segunda conexión si ya hay una activa
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN ||
         wsRef.current.readyState === WebSocket.CONNECTING)
      ) return

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
        console.info("[WS] Conectado")
      }

      ws.onmessage = handleMessage

      ws.onclose = () => {
        setWsConnected(false)
        console.info("[WS] Desconectado — reintentando en 3s...")
        setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        setWsConnected(false)
        ws.close()
      }
    }

    connect()

    return () => {
      wsRef.current?.close()
      wsRef.current = null  // ✅ Limpiar ref en cleanup
    }
  }, [handleMessage, setWsConnected])
}
