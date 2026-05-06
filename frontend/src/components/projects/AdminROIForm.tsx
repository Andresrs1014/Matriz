// frontend/src/components/projects/AdminROIForm.tsx
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Users, Clock, Loader2, Calculator } from "lucide-react"
import { useProjectActions } from "@/hooks/useProjectActions"

interface Props {
  projectId: number
  projectTitle: string
  onClose: () => void
  onSuccess: () => void
}

export default function AdminROIForm({ projectId, projectTitle, onClose, onSuccess }: Props) {
  const { completarROI, loading, error } = useProjectActions()
  const [numPersonas, setNumPersonas] = useState("")
  const [horasActual, setHorasActual] = useState("")
  const [horasNuevo, setHorasNuevo] = useState("")
  const [observacion, setObservacion] = useState("")

  const horasAhorradas = horasActual && horasNuevo
    ? Math.max(0, parseFloat(horasActual) - parseFloat(horasNuevo))
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!numPersonas || !horasActual || !horasNuevo) return
    const result = await completarROI(projectId, {
      num_personas: parseInt(numPersonas),
      horas_proceso_actual: parseFloat(horasActual),
      horas_proceso_nuevo: parseFloat(horasNuevo),
      observacion: observacion.trim() || undefined,
    })
    if (result) onSuccess()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-md shadow-2xl"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
            <div>
              <h2 className="text-base font-semibold text-white">Completar datos operacionales</h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{projectTitle}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                ¿Cuántas personas realizan este proceso? *
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="number" value={numPersonas}
                  onChange={(e) => setNumPersonas(e.target.value)}
                  placeholder="Ej: 5" required min={1}
                  className="w-full pl-9 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Horas proceso actual *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="number" value={horasActual}
                    onChange={(e) => setHorasActual(e.target.value)}
                    placeholder="Ej: 8" required min={0} step={0.5}
                    className="w-full pl-9 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Horas con el proyecto *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="number" value={horasNuevo}
                    onChange={(e) => setHorasNuevo(e.target.value)}
                    placeholder="Ej: 2" required min={0} step={0.5}
                    className="w-full pl-9 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Preview cálculo */}
            {horasAhorradas !== null && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Calculator className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-300">
                  Se ahorrarán <span className="font-semibold">{horasAhorradas.toFixed(1)}h</span> por ciclo
                  {numPersonas ? ` × ${numPersonas} personas = ` : ""}
                  {numPersonas ? <span className="font-semibold">{(horasAhorradas * parseInt(numPersonas)).toFixed(1)} h/h totales</span> : ""}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Observaciones <span className="text-slate-600">(opcional)</span>
              </label>
              <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)}
                rows={2} placeholder="Notas adicionales sobre el proceso..."
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 text-sm hover:text-white transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={loading || !numPersonas || !horasActual || !horasNuevo}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm font-medium hover:bg-electric/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                {loading ? "Calculando..." : "Calcular ROI y cerrar"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
