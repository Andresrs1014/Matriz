// frontend/src/components/projects/SuperadminSalaryModal.tsx
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, DollarSign, Loader2 } from "lucide-react"
import { useProjectActions } from "@/hooks/useProjectActions"

const SEDES = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga", "Otra"]

interface Props {
  projectId: number
  projectTitle: string
  onClose: () => void
  onSuccess: () => void
}

export default function SuperadminSalaryModal({ projectId, projectTitle, onClose, onSuccess }: Props) {
  const { proveerSalario, loading, error } = useProjectActions()
  const [salario, setSalario] = useState("")
  const [cargo, setCargo] = useState("")
  const [sede, setSede] = useState(SEDES[0])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!salario || !cargo) return
    const result = await proveerSalario(projectId, {
      salario_base: parseFloat(salario),
      cargo,
      sede,
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
              <h2 className="text-base font-semibold text-white">Datos salariales</h2>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{projectTitle}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <p className="text-xs text-slate-500 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
              🔒 Esta información es confidencial y no será visible para coordinadores ni usuarios.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Cargo *</label>
              <input
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ej: Analista de procesos"
                required
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Salario base (COP) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="number"
                  value={salario}
                  onChange={(e) => setSalario(e.target.value)}
                  placeholder="3500000"
                  required
                  min={0}
                  className="w-full pl-9 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Sede</label>
              <select
                value={sede}
                onChange={(e) => setSede(e.target.value)}
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-electric/50 transition-colors"
              >
                {SEDES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
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
              <button type="submit" disabled={loading || !salario || !cargo}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                {loading ? "Guardando..." : "Registrar salario"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
