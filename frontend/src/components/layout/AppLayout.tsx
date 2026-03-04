import { useEffect } from "react"
import { Outlet } from "react-router-dom"
import Sidebar   from "./Sidebar"
import TopBar    from "./TopBar"
import MobileNav from "./MobileNav"
import { useProjectStore } from "@/store/projectStore"
import { WS_URL } from "@/lib/constants"

interface AppLayoutProps {
  title:    string
  subtitle?: string
}

export default function AppLayout({ title, subtitle }: AppLayoutProps) {
  const { setWsConnected } = useProjectStore()

  // WebSocket global — conecta una sola vez al montar el layout
  useEffect(() => {
    const ws = new WebSocket(WS_URL)

    ws.onopen  = () => setWsConnected(true)
    ws.onclose = () => setWsConnected(false)
    ws.onerror = () => setWsConnected(false)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        console.info("[WS]", msg.event, msg.data)
        // Los hooks individuales de cada página escuchan el store
        // El broadcast queda disponible para componentes hijos via projectStore
      } catch {
        // mensaje no JSON — ignorar
      }
    }

    return () => ws.close()
  }, [setWsConnected])

  return (
    <div className="flex min-h-screen bg-navy-950">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar title={title} subtitle={subtitle} />

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 animate-fade-in">
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  )
}
