import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, MessageCircle, Info } from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import api from "@/lib/api"
import { cn } from "@/lib/utils"

interface Comment {
  id: number
  project_id: number
  author_id: number
  author_role: string
  author_name: string
  message: string
  tipo: string
  created_at: string
}

interface Props {
  projectId: number
  ownerId: number
}

const TIPO_CONFIG: Record<string, { label: string; class: string }> = {
  comentario:     { label: "Comentario",      class: "bg-slate-700/40 border-slate-600/30" },
  feedback:       { label: "Feedback",        class: "bg-blue-500/10 border-blue-500/20" },
  cambio_estado:  { label: "Cambio de estado",class: "bg-amber-500/10 border-amber-500/20" },
  aprobacion:     { label: "Aprobación",      class: "bg-emerald-500/10 border-emerald-500/20" },
}

const ROLE_COLOR: Record<string, string> = {
  admin:        "text-purple-400",
  coordinador:  "text-electric",
  usuario:      "text-slate-300",
}

export default function ProjectChat({ projectId, ownerId }: Props) {
  const { user } = useAuthStore()
  const [comments, setComments] = useState<Comment[]>([])
  const [message, setMessage] = useState("")
  const [tipo, setTipo] = useState("comentario")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isUsuario = user?.role === "usuario"
  const isOwner = user?.id === ownerId

  async function fetchComments() {
    try {
      const res = await api.get(`/comments/${projectId}`)
      // El usuario solo ve sus propios comentarios + los que le hablan
      const data: Comment[] = res.data
      if (isUsuario) {
        setComments(data.filter(c => c.author_id === user?.id || c.tipo === "feedback"))
      } else {
        setComments(data)
      }
    } catch {
      setComments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComments()
    const interval = setInterval(fetchComments, 5000)
    return () => clearInterval(interval)
  }, [projectId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments])

  async function handleSend() {
    if (!message.trim() || sending) return
    setSending(true)
    try {
      await api.post(`/comments/${projectId}`, { message: message.trim(), tipo })
      setMessage("")
      await fetchComments()
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const tiposDisponibles = isUsuario
    ? ["comentario"]
    : ["comentario", "feedback", "cambio_estado", "aprobacion"]

  return (
    <div className="flex flex-col h-full bg-slate-900/50 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50 bg-slate-800/40">
        <MessageCircle className="w-4 h-4 text-electric" />
        <span className="text-sm font-medium text-slate-200">Canal de comunicación</span>
        {isUsuario && (
          <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            <Info className="w-3 h-3" /> Solo ves tu hilo
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[420px]">
        {loading ? (
          <div className="flex justify-center pt-8">
            <div className="w-5 h-5 border-2 border-electric/30 border-t-electric rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-10 gap-2 text-slate-500">
            <MessageCircle className="w-8 h-8 opacity-30" />
            <span className="text-sm">Sin mensajes aún</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((c) => {
              const tipoConf = TIPO_CONFIG[c.tipo] ?? TIPO_CONFIG.comentario
              const isMine = c.author_id === user?.id
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col gap-1 p-3 rounded-lg border text-sm",
                    tipoConf.class,
                    isMine ? "ml-6" : "mr-6"
                  )}
                >
                  <div className="flex items-center gap-2 justify-between">
                    <span className={cn("font-semibold text-xs", ROLE_COLOR[c.author_role] ?? "text-slate-300")}>
                      {c.author_name}
                      <span className="ml-1 text-slate-500 font-normal">({c.author_role})</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(c.created_at).toLocaleString("es-CO", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit"
                      })}
                    </span>
                  </div>
                  {c.tipo !== "comentario" && (
                    <span className="text-xs text-slate-400 uppercase tracking-wide">{tipoConf.label}</span>
                  )}
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{c.message}</p>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-800/30 flex flex-col gap-2">
        {!isUsuario && (
          <div className="flex gap-2">
            {tiposDisponibles.map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium border transition-all",
                  tipo === t
                    ? "bg-electric/20 border-electric/40 text-electric"
                    : "border-slate-700/50 text-slate-500 hover:text-slate-300"
                )}
              >
                {TIPO_CONFIG[t]?.label ?? t}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Escribe un mensaje... (Enter para enviar)"
            className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:border-electric/50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="px-3 rounded-lg bg-electric/10 border border-electric/30 text-electric hover:bg-electric/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-electric/30 border-t-electric rounded-full animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
