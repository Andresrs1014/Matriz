// frontend/src/components/chat/ProjectChat.tsx
import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Info, Loader2, Trash2 } from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { isAdmin, isSuperAdmin, isCoordinador } from "@/lib/roles"
import { useCommentEventStore } from "@/store/commentEventStore"
import { toast } from "@/store/toastStore"
import api from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Comment } from "@/types/comment"

interface Props {
  projectId: number
}

const TIPO_COLORS: Record<string, string> = {
  comentario:    "border-slate-700/50 bg-slate-800/40",
  feedback:      "border-blue-500/20 bg-blue-500/5",
  cambio_estado: "border-amber-500/20 bg-amber-500/5",
  aprobacion:    "border-emerald-500/20 bg-emerald-500/5",
}

const ROLE_COLORS: Record<string, string> = {
  superadmin:  "text-amber-400",
  admin:       "text-electric",
  coordinador: "text-blue-400",
  usuario:     "text-slate-300",
}

const TIPOS_DISPONIBLES = [
  { value: "comentario",    label: "Comentario" },
  { value: "feedback",      label: "Feedback" },
  { value: "cambio_estado", label: "Estado" },
]

export default function ProjectChat({ projectId }: Props) {
  const { user } = useAuthStore()
  const [comments, setComments] = useState<Comment[]>([])
  const [message, setMessage] = useState("")
  const [tipo, setTipo] = useState("comentario")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const esUsuario = user?.role === "usuario"
  const puedeElegiTipo = isAdmin(user) || isSuperAdmin(user) || isCoordinador(user)

  // Escuchar eventos de nuevos comentarios vía WebSocket
  const lastCommentEvent = useCommentEventStore((s) => s.lastCommentEvent)
  useEffect(() => {
    if (!lastCommentEvent || lastCommentEvent.projectId !== projectId) return
    const incoming = lastCommentEvent.comment
    // Filtrar para usuarios: solo sus mensajes + feedback/cambio_estado
    if (esUsuario && incoming.author_id !== user?.id && incoming.tipo !== "feedback" && incoming.tipo !== "cambio_estado") return
    setComments((prev) => {
      if (prev.some((c) => c.id === incoming.id)) return prev
      return [...prev, incoming]
    })
  }, [lastCommentEvent, projectId, esUsuario, user?.id])

  const fetchComments = useCallback(async () => {
    try {
      // El backend ya filtra según el rol del usuario autenticado
      const { data } = await api.get<Comment[]>(`/projects/${projectId}/comments`)
      setComments(data)
    } catch {
      setComments([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments])

  async function handleSend() {
    if (!message.trim() || sending) return
    setSending(true)
    try {
      const { data: newComment } = await api.post<Comment>(`/projects/${projectId}/comments`, {
        message: message.trim(),
        tipo: esUsuario ? "comentario" : tipo,
      })
      setMessage("")
      setComments((prev) =>
        prev.some((c) => c.id === newComment.id) ? prev : [...prev, newComment]
      )
    } finally {
      setSending(false)
    }
  }

  async function handleDelete(commentId: number) {
    setDeletingId(commentId)
    try {
      await api.delete(`/projects/${projectId}/comments/${commentId}`)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch {
      toast.error("No se pudo eliminar el comentario.")
    } finally {
      setDeletingId(null)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Aviso usuario */}
      {esUsuario && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-800/60 border-b border-slate-700/50 text-xs text-slate-500">
          <Info className="w-3 h-3 shrink-0" />
          Solo ves los mensajes relevantes para tu proyecto
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {loading ? (
          <div className="flex justify-center pt-8">
            <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 gap-2 text-slate-600">
            <p className="text-xs">Sin mensajes aún</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((c) => {
              const isMine = c.author_id === user?.id
              const canDelete = isMine || isAdmin(user) || isSuperAdmin(user) || isCoordinador(user)
              const tipoClass = TIPO_COLORS[c.tipo] ?? TIPO_COLORS.comentario
              const roleColor = ROLE_COLORS[c.author_role] ?? "text-slate-400"
              return (
                <motion.div key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm group relative",
                    tipoClass,
                    isMine ? "ml-6" : "mr-6"
                  )}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={cn("text-xs font-semibold", roleColor)}>
                      {c.author_name}
                      <span className="text-slate-600 font-normal ml-1">({c.author_role})</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-600 shrink-0">
                        {new Date(c.created_at).toLocaleString("es-CO", {
                          month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400 disabled:opacity-50"
                          aria-label="Eliminar comentario"
                        >
                          {deletingId === c.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />
                          }
                        </button>
                      )}
                    </div>
                  </div>
                  {c.tipo !== "comentario" && (
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1">
                      {c.tipo.replace("_", " ")}
                    </span>
                  )}
                  <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{c.message}</p>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-700/50 space-y-2">
        {puedeElegiTipo && (
          <div className="flex gap-1.5">
            {TIPOS_DISPONIBLES.map((t) => (
              <button key={t.value} onClick={() => setTipo(t.value)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all",
                  tipo === t.value
                    ? "bg-electric/20 border-electric/40 text-electric"
                    : "border-slate-700/40 text-slate-600 hover:text-slate-300"
                )}>
                {t.label}
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
          <button onClick={handleSend} disabled={!message.trim() || sending}
            className="px-3 rounded-lg bg-electric/10 border border-electric/30 text-electric hover:bg-electric/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {sending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
