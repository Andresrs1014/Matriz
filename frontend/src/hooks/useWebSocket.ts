import { useEffect, useRef } from "react"
import { useProjectStore } from "@/store/projectStore"
import { useProjects } from "@/hooks/useProjects"
import { toast } from "@/store/toastStore"
import { WS_URL } from "@/lib/constants"

export function useWebSocket() {
  const wsRef             = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setWsConnected } = useProjectStore()
  const { fetchProjects } = useProjects()

  // Guardar fetchProjects en un ref para que el useEffect no dependa de él
  // y no se re-ejecute cada vez que cambia su referencia
  const fetchProjectsRef = useRef(fetchProjects)
  useEffect(() => {
    fetchProjectsRef.current = fetchProjects
  }, [fetchProjects])

  useEffect(() => {
    const connect = () => {
      // Guard — no abrir segunda conexión si ya hay una activa
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

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data) as { event: string; data: any }
          console.log("[WS] mensaje recibido:", msg)

          switch (msg.event) {
            case "project.created":
              fetchProjectsRef.current()
              toast.success(`Proyecto creado: "${msg.data?.title ?? "sin título"}"`)
              break

            case "evaluation_created":
              fetchProjectsRef.current()
              toast.success(`Proyecto evaluado: cuadrante ${msg.data?.quadrant ?? ""}`)
              break

            case "project.webhook":
              fetchProjectsRef.current()
              toast.info(`Proyecto sincronizado desde Microsoft Lists: "${msg.data?.title ?? ""}"`)
              break

            default:
              break
          }
        } catch {
          // mensaje no JSON — ignorar
        }
      }

      ws.onclose = () => {
        setWsConnected(false)
        console.info("[WS] Desconectado — reintentando en 3s...")
        reconnectTimerRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        setWsConnected(false)
        ws.close()
      }
    }

    connect()

    return () => {
      // Cancelar reconexión programada para evitar conexiones huérfanas
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      // Anular onclose antes de cerrar para que no programe otra reconexión
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [setWsConnected]) // fetchProjects se accede vía ref — no necesita estar aquí
}
