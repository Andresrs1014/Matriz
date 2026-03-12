// frontend/src/components/projects/ProjectSubmitForm.tsx
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Send, Loader2 } from "lucide-react"
import api from "@/lib/api"

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function ProjectSubmitForm({ onClose, onSuccess }: Props) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError("El nombre del proyecto es obligatorio"); return }
    setLoading(true)
    setError("")
    try {
      await api.post("/projects", { title: title.trim(), description: description.trim() || null })
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error al crear el proyecto")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
            <h2 className="text-base font-semibold text-white">Subir proyecto</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Nombre del proyecto *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Automatización de reportes semanales"
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Descripción <span className="text-slate-600">(opcional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe brevemente el problema que resuelve o el objetivo del proyecto..."
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 text-sm hover:text-white hover:border-slate-600 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm font-medium hover:bg-electric/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? "Enviando..." : "Enviar proyecto"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
