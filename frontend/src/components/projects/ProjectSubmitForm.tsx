// frontend/src/components/projects/ProjectSubmitForm.tsx
import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Send, Loader2, Plus, UserRound, Calendar, Sparkles } from "lucide-react"
import api from "@/lib/api"
import { useAuthStore } from "@/store/authStore"

interface Props {
  onClose: () => void
  onSuccess: () => void
}

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  rows?: number
}

function TextAreaField({ label, value, onChange, placeholder, rows = 4 }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors resize-none"
      />
    </div>
  )
}

export default function ProjectSubmitForm({ onClose, onSuccess }: Props) {
  const user = useAuthStore((s) => s.user)
  const uploaderName = useMemo(
    () => user?.full_name?.trim() || user?.email || "Usuario actual",
    [user]
  )
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    []
  )

  const [title, setTitle] = useState("")
  const [okrObjectives, setOkrObjectives] = useState("")
  const [keyResults, setKeyResults] = useState("")
  const [keyActions, setKeyActions] = useState("")
  const [resources, setResources] = useState("")
  const [fiveWhys, setFiveWhys] = useState("")
  const [measurementMethods, setMeasurementMethods] = useState("")
  const [collaboratorInput, setCollaboratorInput] = useState("")
  const [collaborators, setCollaborators] = useState<string[]>([uploaderName])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function addCollaborator(name: string) {
    const clean = name.trim()
    if (!clean) return
    setCollaborators((prev) => (
      prev.some((item) => item.toLowerCase() === clean.toLowerCase())
        ? prev
        : [...prev, clean]
    ))
    setCollaboratorInput("")
  }

  function removeCollaborator(name: string) {
    setCollaborators((prev) => prev.filter((item) => item !== name))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError("El nombre del OKR es obligatorio.")
      return
    }
    if (!okrObjectives.trim()) {
      setError("Los objetivos del OKR son obligatorios.")
      return
    }

    setLoading(true)
    setError("")
    try {
      await api.post("/projects", {
        title: title.trim(),
        description: okrObjectives.trim(),
        okr_objectives: okrObjectives.trim(),
        key_results: keyResults.trim() || null,
        key_actions: keyActions.trim() || null,
        resources: resources.trim() || null,
        five_whys: fiveWhys.trim() || null,
        measurement_methods: measurementMethods.trim() || null,
        collaborators,
      })
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
          className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
            <div>
              <h2 className="text-base font-semibold text-white">Subir OKR / Proyecto</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Registra el detalle estructurado del OKR que se va a evaluar
              </p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(92vh-73px)] px-6 py-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide">
                  <UserRound className="w-3.5 h-3.5 text-electric" />
                  Adjuntado Por
                </div>
                <p className="text-sm text-white font-medium mt-1.5">{uploaderName}</p>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide">
                  <Calendar className="w-3.5 h-3.5 text-electric" />
                  Fecha De Carga
                </div>
                <p className="text-sm text-white font-medium mt-1.5">{todayLabel}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Nombre Del OKR *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Optimización del proceso de facturación"
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
              />
            </div>

            <div className="rounded-xl border border-electric/20 bg-electric/5 px-4 py-3 space-y-3">
              <div className="flex items-center gap-2 text-xs text-electric uppercase tracking-wide font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                Personas Que Colaboraron
              </div>

              <div className="flex flex-wrap gap-2">
                {collaborators.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-2 rounded-full border border-electric/30 bg-electric/10 px-3 py-1 text-xs text-electric"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => removeCollaborator(name)}
                      className="text-electric/80 hover:text-white transition-colors"
                      aria-label={`Quitar a ${name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  value={collaboratorInput}
                  onChange={(e) => setCollaboratorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCollaborator(collaboratorInput)
                    }
                  }}
                  placeholder="Agregar persona que originó o apoyó la idea"
                  className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => addCollaborator(collaboratorInput)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm hover:bg-electric/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              </div>
            </div>

            <TextAreaField
              label="Objetivos Del OKR *"
              value={okrObjectives}
              onChange={setOkrObjectives}
              placeholder="Describe el objetivo general del OKR..."
            />
            <TextAreaField
              label="Resultados Clave"
              value={keyResults}
              onChange={setKeyResults}
              placeholder="Especifica los resultados clave esperados..."
            />
            <TextAreaField
              label="Acciones Clave"
              value={keyActions}
              onChange={setKeyActions}
              placeholder="Detalla las acciones clave para ejecutar el OKR..."
            />
            <TextAreaField
              label="Recursos"
              value={resources}
              onChange={setResources}
              placeholder="Indica recursos técnicos, humanos, financieros o tecnológicos..."
            />
            <TextAreaField
              label="Los 5 Porqué"
              value={fiveWhys}
              onChange={setFiveWhys}
              placeholder="Explica las razones del OKR usando la lógica de los 5 porqué..."
            />
            <TextAreaField
              label="Métodos De Medición"
              value={measurementMethods}
              onChange={setMeasurementMethods}
              placeholder="Indica la fórmula, indicador o medio de medición que se usará..."
            />

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
                {loading ? "Enviando..." : "Enviar OKR"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
