// frontend/src/components/projects/SuperadminApprovalModal.tsx
//
// ARQUITECTURA DE PASOS:
// Step "list" → muestra paquetes existentes + botón "Crear paquete nuevo"
// Step "create" → formulario inline para crear paquete (Opción 1 actual)
// Step "fix-salary" → ← NUEVO: corregir salario mal ingresado
//
// TODO (Opción 2 futura): en Step "create", reemplazar el formulario inline
// por: navigate('/config/matrix') y dejar que el usuario vuelva manualmente.
// El endpoint POST /matrix/categories/with-questions ya está listo para ambas opciones.

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Plus, Trash2, Loader2, CheckCircle2, ChevronLeft, Package, AlertTriangle
} from "lucide-react"
import api from "@/lib/api"
import { useProjectActions } from "@/hooks/useProjectActions"
import { cn } from "@/lib/utils"

interface Category {
  id: number
  name: string
  description: string | null
  is_default: boolean
}

interface NewQuestion {
  text: string
  axis: "impact" | "effort"
}

interface Props {
  projectId: number
  projectTitle: string
  onClose: () => void
  onSuccess: () => void
  // ← NUEVO: si el proyecto ya tiene salario registrado, permitir corrección
  showSalaryCorrection?: boolean
}

type Step = "list" | "create" | "fix-salary"

export default function SuperadminApprovalModal({
  projectId, projectTitle, onClose, onSuccess, showSalaryCorrection = false
}: Props) {
  const { superaprobar, loading: approving, error: approveError } = useProjectActions()

  // ── List step ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("list")
  const [categories, setCategories] = useState<Category[]>([])
  const [questionCounts, setQuestionCounts] = useState<Record<number, number>>({})
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [loadingCats, setLoadingCats] = useState(true)

  // ── Create step ────────────────────────────────────────────────────────────
  const [newPackageName, setNewPackageName] = useState("")
  const [newPackageDesc, setNewPackageDesc] = useState("")
  const [newQuestions, setNewQuestions] = useState<NewQuestion[]>([
    { text: "", axis: "impact" },
    { text: "", axis: "effort" },
  ])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")

  // ── Fix salary step ────────────────────────────────────────────────────────
  const [salaryCargo, setSalaryCargo] = useState("")
  const [salaryBase, setSalaryBase] = useState("")
  const [salarySede, setSalarySede] = useState("")
  const [fixingSalary, setFixingSalary] = useState(false)
  const [fixSalaryError, setFixSalaryError] = useState("")
  const [fixSalaryOk, setFixSalaryOk] = useState(false)

  // ── Cargar categorías ──────────────────────────────────────────────────────
  async function loadCategories() {
    setLoadingCats(true)
    try {
      const [{ data: cats }, { data: questions }] = await Promise.all([
        api.get("/matrix/categories"),
        api.get("/matrix/questions"),
      ])
      const counts: Record<number, number> = {}
      questions.forEach((q: any) => {
        counts[q.category_id] = (counts[q.category_id] ?? 0) + 1
      })
      setCategories(cats)
      setQuestionCounts(counts)
    } finally {
      setLoadingCats(false)
    }
  }

  useEffect(() => { loadCategories() }, [])

  // ── Create step: handlers ──────────────────────────────────────────────────
  function addQuestion(axis: "impact" | "effort") {
    setNewQuestions((prev) => [...prev, { text: "", axis }])
  }

  function updateQuestion(idx: number, field: keyof NewQuestion, value: string) {
    setNewQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    )
  }

  function removeQuestion(idx: number) {
    setNewQuestions((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleCreatePackage() {
    setCreateError("")
    if (!newPackageName.trim()) { setCreateError("El nombre del paquete es obligatorio."); return }
    const filled = newQuestions.filter((q) => q.text.trim())
    const hasImpact = filled.some((q) => q.axis === "impact")
    const hasEffort = filled.some((q) => q.axis === "effort")
    if (!hasImpact) { setCreateError("Agrega al menos 1 pregunta de Impacto."); return }
    if (!hasEffort) { setCreateError("Agrega al menos 1 pregunta de Esfuerzo."); return }
    setCreating(true)
    try {
      const { data } = await api.post("/matrix/categories/with-questions", {
        name: newPackageName.trim(),
        description: newPackageDesc.trim() || null,
        is_default: false,
        questions: filled.map((q, i) => ({
          text: q.text.trim(),
          axis: q.axis,
          weight: 1.0,
          order: i,
        })),
      })
      await loadCategories()
      setSelectedCategoryId(data.id)
      setStep("list")
      setNewPackageName("")
      setNewPackageDesc("")
      setNewQuestions([{ text: "", axis: "impact" }, { text: "", axis: "effort" }])
    } catch (e: any) {
      setCreateError(e?.response?.data?.detail ?? "Error al crear el paquete.")
    } finally {
      setCreating(false)
    }
  }

  // ── Fix salary: handler ────────────────────────────────────────────────────
  async function handleFixSalary() {
    setFixSalaryError("")
    const salNum = parseFloat(salaryBase.replace(/\./g, "").replace(",", "."))
    if (!salaryCargo.trim()) { setFixSalaryError("El cargo es obligatorio."); return }
    if (isNaN(salNum) || salNum <= 0) { setFixSalaryError("El salario debe ser un número positivo."); return }
    setFixingSalary(true)
    try {
      await api.patch(`/projects/${projectId}/corregir-salario`, {
        cargo: salaryCargo.trim(),
        salario_base: salNum,
        sede: salarySede.trim() || "No especificada",
      })
      setFixSalaryOk(true)
    } catch (e: any) {
      setFixSalaryError(e?.response?.data?.detail ?? "Error al corregir el salario.")
    } finally {
      setFixingSalary(false)
    }
  }

  // ── Aprobar proyecto con el paquete seleccionado ───────────────────────────
  async function handleApprove() {
    if (!selectedCategoryId) return
    const { data: questions } = await api.get(`/matrix/questions?category_id=${selectedCategoryId}`)
    const question_ids: number[] = questions.map((q: any) => q.id)
    const result = await superaprobar(projectId, {
      question_ids,
      custom_questions: [],
    })
    if (result) onSuccess()
  }

  // ── Preguntas del form divididas por eje ──────────────────────────────────
  const impactQs = newQuestions.map((q, i) => ({ ...q, idx: i })).filter((q) => q.axis === "impact")
  const effortQs = newQuestions.map((q, i) => ({ ...q, idx: i })).filter((q) => q.axis === "effort")

  const stepTitle = {
    list: "Aprobar proyecto",
    create: "Crear paquete de preguntas",
    "fix-salary": "Corregir salario",
  }[step]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900 border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 shrink-0">
            <div className="flex items-center gap-3">
              {step !== "list" && (
                <button
                  onClick={() => { setStep("list"); setCreateError(""); setFixSalaryError(""); setFixSalaryOk(false) }}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <div>
                <h2 className="text-base font-semibold text-white">{stepTitle}</h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{projectTitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-4">

            {/* ── STEP: list ─────────────────────────────────────────────── */}
            {step === "list" && (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  Elige el paquete de preguntas con el que se evaluará este proyecto.
                </p>

                {loadingCats ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No hay paquetes creados aún.</p>
                    <p className="text-xs text-slate-600 mt-1">Crea uno para poder aprobar este proyecto.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((cat) => {
                      const selected = selectedCategoryId === cat.id
                      return (
                        <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)}
                          className={cn(
                            "w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
                            selected
                              ? "bg-amber-500/10 border-amber-500/40"
                              : "bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60"
                          )}>
                          <div className={cn(
                            "w-4 h-4 rounded-full border mt-0.5 shrink-0 transition-all",
                            selected ? "bg-amber-400 border-amber-400" : "border-slate-600"
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-sm font-semibold", selected ? "text-amber-300" : "text-white")}>
                                {cat.name}
                              </span>
                              {cat.is_default && (
                                <span className="text-[10px] bg-electric/10 text-electric px-1.5 py-0.5 rounded border border-electric/20">
                                  Default
                                </span>
                              )}
                            </div>
                            {cat.description && (
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{cat.description}</p>
                            )}
                            <p className="text-[10px] text-slate-600 mt-0.5">
                              {questionCounts[cat.id] ?? 0} pregunta{(questionCounts[cat.id] ?? 0) !== 1 ? "s" : ""}
                            </p>
                          </div>
                          {selected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Botón crear paquete nuevo */}
                <button
                  onClick={() => setStep("create")}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-700/60 text-slate-500 text-sm hover:border-electric/40 hover:text-electric transition-all mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Crear paquete nuevo
                </button>

                {/* ← NUEVO: botón corregir salario (solo si ya está en pendiente_salario) */}
                {showSalaryCorrection && (
                  <button
                    onClick={() => setStep("fix-salary")}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-amber-700/40 text-amber-600 text-sm hover:border-amber-500/60 hover:text-amber-400 transition-all"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Corregir salario ingresado
                  </button>
                )}

                {approveError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {approveError}
                  </p>
                )}
              </div>
            )}

            {/* ── STEP: create ───────────────────────────────────────────── */}
            {step === "create" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500">
                  Crea un paquete con al menos 1 pregunta de Impacto y 1 de Esfuerzo.
                  Al guardar, quedará disponible para todos los proyectos.
                </p>

                {/* Nombre */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Nombre del paquete *
                  </label>
                  <input value={newPackageName}
                    onChange={(e) => setNewPackageName(e.target.value)}
                    placeholder="Ej: Evaluación de automatización"
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                  />
                </div>

                {/* Descripción */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Descripción <span className="text-slate-600">(opcional)</span>
                  </label>
                  <input value={newPackageDesc}
                    onChange={(e) => setNewPackageDesc(e.target.value)}
                    placeholder="Para qué tipo de proyectos aplica..."
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-electric/50 transition-colors"
                  />
                </div>

                {/* Preguntas de Impacto */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                      Preguntas de Impacto
                    </p>
                    <button onClick={() => addQuestion("impact")}
                      className="text-xs text-slate-500 hover:text-cyan-400 flex items-center gap-1 transition-colors">
                      <Plus className="w-3 h-3" /> Añadir
                    </button>
                  </div>
                  {impactQs.length === 0 && (
                    <p className="text-xs text-slate-600 italic">Sin preguntas de impacto aún.</p>
                  )}
                  {impactQs.map(({ idx }) => (
                    <div key={idx} className="flex gap-2">
                      <input value={newQuestions[idx].text}
                        onChange={(e) => updateQuestion(idx, "text", e.target.value)}
                        placeholder="¿Cuántos usuarios se benefician?"
                        className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                      />
                      <button onClick={() => removeQuestion(idx)}
                        className="p-2 text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Preguntas de Esfuerzo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                      Preguntas de Esfuerzo
                    </p>
                    <button onClick={() => addQuestion("effort")}
                      className="text-xs text-slate-500 hover:text-indigo-400 flex items-center gap-1 transition-colors">
                      <Plus className="w-3 h-3" /> Añadir
                    </button>
                  </div>
                  {effortQs.length === 0 && (
                    <p className="text-xs text-slate-600 italic">Sin preguntas de esfuerzo aún.</p>
                  )}
                  {effortQs.map(({ idx }) => (
                    <div key={idx} className="flex gap-2">
                      <input value={newQuestions[idx].text}
                        onChange={(e) => updateQuestion(idx, "text", e.target.value)}
                        placeholder="¿Cuántas horas requiere la implementación?"
                        className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                      />
                      <button onClick={() => removeQuestion(idx)}
                        className="p-2 text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {createError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {createError}
                  </p>
                )}
              </div>
            )}

            {/* ── STEP: fix-salary ────────────────────────────────────────── */}
            {step === "fix-salary" && (
              <div className="space-y-4">
                {fixSalaryOk ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                    <p className="text-sm text-slate-300 font-medium">Salario corregido correctamente.</p>
                    <button
                      onClick={() => { setStep("list"); setFixSalaryOk(false) }}
                      className="mt-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 transition-all"
                    >
                      Volver
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      Esto sobreescribirá el salario y recalculará el valor/hora. El admin deberá volver a completar las horas.
                    </p>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Cargo *</label>
                      <input value={salaryCargo} onChange={(e) => setSalaryCargo(e.target.value)}
                        placeholder="Ej: Analista de procesos"
                        className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Salario base (COP) *</label>
                      <input value={salaryBase} onChange={(e) => setSalaryBase(e.target.value)}
                        placeholder="Ej: 3500000"
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Sede <span className="text-slate-600">(opcional)</span></label>
                      <input value={salarySede} onChange={(e) => setSalarySede(e.target.value)}
                        placeholder="Ej: Bogotá"
                        className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                    </div>

                    {fixSalaryError && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                        {fixSalaryError}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-700/50 flex gap-3 shrink-0">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-700/50 text-slate-400 text-sm hover:text-white transition-all">
              Cancelar
            </button>

            {step === "list" && (
              <button onClick={handleApprove}
                disabled={approving || !selectedCategoryId}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {approving ? "Aprobando..." : "Aprobar proyecto"}
              </button>
            )}

            {step === "create" && (
              <button onClick={handleCreatePackage} disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm font-medium hover:bg-electric/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                {creating ? "Guardando..." : "Guardar paquete"}
              </button>
            )}

            {step === "fix-salary" && !fixSalaryOk && (
              <button onClick={handleFixSalary} disabled={fixingSalary}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {fixingSalary ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                {fixingSalary ? "Guardando..." : "Corregir salario"}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
