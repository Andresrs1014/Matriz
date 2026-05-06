// frontend/src/components/projects/ProjectSubmitForm.tsx
import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { X, Send, Loader2, Plus, UserRound, Calendar, Sparkles, Trash2, Save } from "lucide-react"
import api from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { toast } from "@/store/toastStore"
import EvidenceUploader from "./EvidenceUploader"
import type { PendingFile } from "./EvidenceDropzone"

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
    () => new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }),
    []
  )

  const [title, setTitle] = useState("")
  const [okrObjectives, setOkrObjectives] = useState("")
  const [keyResults, setKeyResults] = useState("")
  const [keyActions, setKeyActions] = useState("")
  const [resources, setResources] = useState("")
  const [fiveWhys, setFiveWhys] = useState("")
  const [measurementMethods, setMeasurementMethods] = useState("")
  const [okrCreator, setOkrCreator] = useState("")
  const [collaboratorInput, setCollaboratorInput] = useState("")
  const [collaborators, setCollaborators] = useState<string[]>([uploaderName])

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [draftId, setDraftId] = useState<number | null>(null)
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(true)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cargar borrador al montar
  useEffect(() => {
    api.get("/drafts/me")
      .then(({ data }) => {
        if (data) {
          setDraftId(data.id)
          setTitle(data.title ?? "")
          setOkrObjectives(data.okr_objectives ?? "")
          setKeyResults(data.key_results ?? "")
          setKeyActions(data.key_actions ?? "")
          setResources(data.resources ?? "")
          setFiveWhys(data.five_whys ?? "")
          setMeasurementMethods(data.measurement_methods ?? "")
          setOkrCreator(data.okr_creator ?? "")
          if (data.collaborators?.length > 0) setCollaborators(data.collaborators)
          setDraftUpdatedAt(data.updated_at)
        }
      })
      .catch(() => { /* sin borrador */ })
      .finally(() => setLoadingDraft(false))
  }, [])

  // Auto-guardar borrador con debounce de 1.5s cuando hay algo escrito
  const hasContent = title || okrObjectives || keyResults || keyActions || resources || fiveWhys || measurementMethods || okrCreator
  useEffect(() => {
    if (loadingDraft) return // no guardar mientras cargamos
    if (!hasContent) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setSavingDraft(true)
      api.put("/drafts/me", {
        title: title || null,
        okr_objectives: okrObjectives || null,
        key_results: keyResults || null,
        key_actions: keyActions || null,
        resources: resources || null,
        five_whys: fiveWhys || null,
        measurement_methods: measurementMethods || null,
        okr_creator: okrCreator || null,
        collaborators,
      })
        .then(({ data }) => {
          setDraftId(data.id)
          setDraftUpdatedAt(data.updated_at)
        })
        .catch(() => { /* fallo silencioso */ })
        .finally(() => setSavingDraft(false))
    }, 1500)

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [title, okrObjectives, keyResults, keyActions, resources, fiveWhys, measurementMethods, okrCreator, collaborators, loadingDraft])

  async function handleDiscardDraft() {
    if (!confirm("¿Descartar el borrador? Se eliminará permanentemente.")) return
    try {
      await api.delete("/drafts/me")
    } catch { /* noop */ }
    setDraftId(null)
    setDraftUpdatedAt(null)
    setTitle("")
    setOkrObjectives("")
    setKeyResults("")
    setKeyActions("")
    setResources("")
    setFiveWhys("")
    setMeasurementMethods("")
    setOkrCreator("")
    setCollaborators([uploaderName])
  }

  function addCollaborator(name: string) {
    const clean = name.trim()
    if (!clean) return
    setCollaborators((prev) =>
      prev.some((item) => item.toLowerCase() === clean.toLowerCase()) ? prev : [...prev, clean]
    )
    setCollaboratorInput("")
  }

  function removeCollaborator(name: string) {
    setCollaborators((prev) => prev.filter((item) => item !== name))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError("El nombre del OKR es obligatorio."); return }
    if (!okrObjectives.trim()) { setError("Los objetivos del OKR son obligatorios."); return }

    setLoading(true)
    setError("")
    try {
      const { data: project } = await api.post("/projects", {
        title: title.trim(),
        description: okrObjectives.trim(),
        okr_objectives: okrObjectives.trim(),
        key_results: keyResults.trim() || null,
        key_actions: keyActions.trim() || null,
        resources: resources.trim() || null,
        five_whys: fiveWhys.trim() || null,
        measurement_methods: measurementMethods.trim() || null,
        okr_creator: okrCreator.trim() || null,
        collaborators,
      })

      const validFiles = pendingFiles.filter((f) => !f.error)
      let uploaded = 0
      let failed = 0
      if (validFiles.length > 0 && project?.id) {
        for (const pf of validFiles) {
          const form = new FormData()
          form.append("file", pf.file)
          try {
            await api.post(`/projects/${project.id}/evidence`, form, {
              headers: { "Content-Type": "multipart/form-data" },
            })
            uploaded++
          } catch {
            failed++
          }
        }
        if (failed > 0) {
          toast.warning(`${uploaded} de ${validFiles.length} evidencias se cargaron. ${failed} fallaron — puedes volver a intentarlo desde el detalle del proyecto.`)
        } else if (uploaded > 0) {
          toast.success(`${uploaded} evidencias adjuntadas.`)
        }
      }

      // Borrar el borrador al enviar exitosamente
      if (draftId) await api.delete("/drafts/me").catch(() => {})
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error al crear el proyecto")
    } finally {
      setLoading(false)
    }
  }

  const draftLabel = draftUpdatedAt
    ? `Borrador · ${new Date(draftUpdatedAt).toLocaleString("es-CO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : "Borrador"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div>
            <h2 className="text-base font-semibold text-white">Subir OKR / Proyecto</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Registra el detalle estructurado del OKR que se va a evaluar
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Estado borrador */}
            {!loadingDraft && (draftId || savingDraft) && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-400">
                  {savingDraft
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Guardando...</>
                    : <><Save className="w-3 h-3" /> {draftLabel}</>
                  }
                </span>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  title="Descartar borrador"
                  className="text-slate-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loadingDraft ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-5 h-5 border-2 border-electric/30 border-t-electric rounded-full animate-spin" />
          </div>
        ) : (
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                ¿Quién Creó El OKR?
              </label>
              <input
                value={okrCreator}
                onChange={(e) => setOkrCreator(e.target.value)}
                placeholder="Nombre de la persona que originó la idea del OKR"
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
                  <span key={name} className="inline-flex items-center gap-2 rounded-full border border-electric/30 bg-electric/10 px-3 py-1 text-xs text-electric">
                    {name}
                    <button type="button" onClick={() => removeCollaborator(name)} className="text-electric/80 hover:text-white transition-colors" aria-label={`Quitar a ${name}`}>
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
                  placeholder="Agregar persona que originó o apoyó la idea"
                  className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                />
                <button type="button" onClick={() => addCollaborator(collaboratorInput)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm hover:bg-electric/20 transition-all">
                  <Plus className="w-4 h-4" /> Agregar
                </button>
              </div>
            </div>

            <TextAreaField label="Objetivos Del OKR *" value={okrObjectives} onChange={setOkrObjectives} placeholder="Describe el objetivo general del OKR..." />
            <TextAreaField label="Resultados Clave" value={keyResults} onChange={setKeyResults} placeholder="Especifica los resultados clave esperados..." />
            <TextAreaField label="Acciones Clave" value={keyActions} onChange={setKeyActions} placeholder="Detalla las acciones clave para ejecutar el OKR..." />
            <TextAreaField label="Recursos" value={resources} onChange={setResources} placeholder="Indica recursos técnicos, humanos, financieros o tecnológicos..." />
            <TextAreaField label="Los 5 Porqué" value={fiveWhys} onChange={setFiveWhys} placeholder="Explica las razones del OKR usando la lógica de los 5 porqué..." />
            <TextAreaField label="Métodos De Medición" value={measurementMethods} onChange={setMeasurementMethods} placeholder="Indica la fórmula, indicador o medio de medición que se usará..." />

            <EvidenceUploader mode="pending" files={pendingFiles} onChange={setPendingFiles} />

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 text-sm hover:text-white hover:border-slate-600 transition-all">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm font-medium hover:bg-electric/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? "Enviando..." : "Enviar OKR"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
