// frontend/src/components/projects/ProjectEditModal.tsx
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { X, Save, Loader2, Plus, Sparkles } from "lucide-react"
import api from "@/lib/api"
import type { Project } from "@/types/project"

interface Props {
  project: Project
  onClose: () => void
  onSuccess: () => void
}

function Field({ label, value, onChange, placeholder, rows }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
        />
      )}
    </div>
  )
}

export default function ProjectEditModal({ project, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState(project.title)
  const [okrObjectives, setOkrObjectives] = useState(project.okr_objectives ?? project.description ?? "")
  const [keyResults, setKeyResults] = useState(project.key_results ?? "")
  const [keyActions, setKeyActions] = useState(project.key_actions ?? "")
  const [resources, setResources] = useState(project.resources ?? "")
  const [fiveWhys, setFiveWhys] = useState(project.five_whys ?? "")
  const [measurementMethods, setMeasurementMethods] = useState(project.measurement_methods ?? "")
  const [okrCreator, setOkrCreator] = useState(project.okr_creator ?? "")
  const [collaborators, setCollaborators] = useState<string[]>(project.collaborators ?? [])
  const [collaboratorInput, setCollaboratorInput] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function addCollaborator(name: string) {
    const clean = name.trim()
    if (!clean) return
    setCollaborators((prev) =>
      prev.some((c) => c.toLowerCase() === clean.toLowerCase()) ? prev : [...prev, clean]
    )
    setCollaboratorInput("")
  }

  async function handleSave() {
    if (!title.trim()) { setError("El nombre del OKR es obligatorio."); return }
    setLoading(true)
    setError("")
    try {
      await api.patch(`/projects/${project.id}`, {
        title: title.trim(),
        okr_objectives: okrObjectives.trim() || null,
        key_results: keyResults.trim() || null,
        key_actions: keyActions.trim() || null,
        resources: resources.trim() || null,
        five_whys: fiveWhys.trim() || null,
        measurement_methods: measurementMethods.trim() || null,
        okr_creator: okrCreator.trim() || null,
        collaborators,
      })
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error al guardar los cambios.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div>
            <h2 className="text-base font-semibold text-white">Editar OKR</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{project.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(92vh-73px)] px-6 py-5 space-y-5">
          <Field label="Nombre Del OKR *" value={title} onChange={setTitle} placeholder="Nombre del OKR" />
          <Field label="¿Quién Creó El OKR?" value={okrCreator} onChange={setOkrCreator} placeholder="Nombre de la persona que originó la idea" />
          <Field label="Objetivos Del OKR" value={okrObjectives} onChange={setOkrObjectives} placeholder="Describe el objetivo general..." rows={4} />
          <Field label="Resultados Clave" value={keyResults} onChange={setKeyResults} placeholder="Resultados clave esperados..." rows={3} />
          <Field label="Acciones Clave" value={keyActions} onChange={setKeyActions} placeholder="Acciones clave para ejecutar el OKR..." rows={3} />
          <Field label="Recursos" value={resources} onChange={setResources} placeholder="Recursos técnicos, humanos, financieros..." rows={3} />
          <Field label="Los 5 Porqué" value={fiveWhys} onChange={setFiveWhys} placeholder="Razones del OKR con la lógica de los 5 porqué..." rows={3} />
          <Field label="Métodos De Medición" value={measurementMethods} onChange={setMeasurementMethods} placeholder="Fórmula, indicador o medio de medición..." rows={3} />

          {/* Colaboradores */}
          <div className="rounded-xl border border-electric/20 bg-electric/5 px-4 py-3 space-y-3">
            <div className="flex items-center gap-2 text-xs text-electric uppercase tracking-wide font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Personas Que Colaboraron
            </div>
            <div className="flex flex-wrap gap-2">
              {collaborators.map((name) => (
                <span key={name} className="inline-flex items-center gap-2 rounded-full border border-electric/30 bg-electric/10 px-3 py-1 text-xs text-electric">
                  {name}
                  <button type="button" onClick={() => setCollaborators((p) => p.filter((c) => c !== name))}
                    className="text-electric/80 hover:text-white transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={collaboratorInput}
                onChange={(e) => setCollaboratorInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCollaborator(collaboratorInput) } }}
                placeholder="Agregar colaborador"
                className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
              />
              <button type="button" onClick={() => addCollaborator(collaboratorInput)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm hover:bg-electric/20 transition-all">
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 text-sm hover:text-white hover:border-slate-600 transition-all">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm font-medium hover:bg-electric/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
