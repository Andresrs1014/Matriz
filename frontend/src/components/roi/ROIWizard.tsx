import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, DollarSign, Clock, TrendingUp, Loader2 } from "lucide-react"
import type { ROIRead } from "@/types/roi"
import { useROI } from "@/hooks/useROI"
import ROIResult from "@/components/roi/ROIResult"

interface Props {
  projectId:   number
  projectName: string
  onClose:     () => void
}

interface FormState {
  horas_inversion:        string
  valor_hora:             string
  costo_infraestructura:  string
  horas_ahorradas_semana: string
  semanas_anio:           string
  ahorro_directo:         string
  ahorro_errores:         string
}

const INITIAL: FormState = {
  horas_inversion:        "",
  valor_hora:             "",
  costo_infraestructura:  "0",
  horas_ahorradas_semana: "",
  semanas_anio:           "48",
  ahorro_directo:         "0",
  ahorro_errores:         "0",
}

function NumericField({
  label, hint, value, unit, onChange,
}: {
  label: string; hint?: string; value: string; unit: string; onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-300">{label}</label>
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 select-none">{unit}</span>
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white
                     placeholder-slate-600 focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric/30
                     [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
    </div>
  )
}

export default function ROIWizard({ projectId, projectName, onClose }: Props) {
  const [form,   setForm]   = useState<FormState>(INITIAL)
  const [result, setResult] = useState<ROIRead | null>(null)
  const { submitting, submitROI } = useROI(projectId)

  function set(field: keyof FormState) {
    return (v: string) => setForm((prev) => ({ ...prev, [field]: v }))
  }

  function isValid() {
    return (
      Number(form.horas_inversion) > 0 &&
      Number(form.valor_hora) > 0 &&
      Number(form.horas_ahorradas_semana) > 0 &&
      Number(form.semanas_anio) > 0
    )
  }

  async function handleSubmit() {
    if (!isValid()) return
    try {
      const roi = await submitROI({
        horas_inversion:        Number(form.horas_inversion),
        valor_hora:             Number(form.valor_hora),
        costo_infraestructura:  Number(form.costo_infraestructura),
        horas_ahorradas_semana: Number(form.horas_ahorradas_semana),
        semanas_anio:           Number(form.semanas_anio),
        ahorro_directo:         Number(form.ahorro_directo),
        ahorro_errores:         Number(form.ahorro_errores),
      })
      setResult(roi)
    } catch {
      // error manejado por interceptor axios
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <div>
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              <span className="text-sm font-semibold text-white">Evaluación ROI</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{projectName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-700 transition-all">
            <X size={16} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {result ? (
            <ROIResult key="result" roi={result} onClose={onClose} />
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-6 max-h-[70vh] overflow-y-auto"
            >
              {/* Sección Inversión */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={13} className="text-rose-400" />
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Inversión</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumericField label="Horas de inversión" hint="Total de horas dedicadas" value={form.horas_inversion} unit="h" onChange={set("horas_inversion")} />
                  <NumericField label="Valor de la hora" hint="Costo por hora ($)" value={form.valor_hora} unit="$" onChange={set("valor_hora")} />
                </div>
                <NumericField label="Costo de infraestructura" hint="Licencias, servidores, tools ($) — opcional" value={form.costo_infraestructura} unit="$" onChange={set("costo_infraestructura")} />
              </div>

              <div className="border-t border-navy-700" />

              {/* Sección Beneficios */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Beneficios esperados</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumericField label="Horas ahorradas / semana" hint="Horas que libera este proyecto" value={form.horas_ahorradas_semana} unit="h" onChange={set("horas_ahorradas_semana")} />
                  <NumericField label="Semanas laborales / año" hint="Por defecto 48" value={form.semanas_anio} unit="s" onChange={set("semanas_anio")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumericField label="Ahorro directo anual" hint="Ahorro monetario directo ($) — opcional" value={form.ahorro_directo} unit="$" onChange={set("ahorro_directo")} />
                  <NumericField label="Ahorro por errores" hint="Reducción de errores / reproceso ($) — opcional" value={form.ahorro_errores} unit="$" onChange={set("ahorro_errores")} />
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-navy-600 text-sm text-slate-400 hover:text-white hover:border-navy-500 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!isValid() || submitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 text-sm font-semibold text-white
                             transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><Loader2 size={14} className="animate-spin" /> Calculando...</>
                  ) : (
                    <>Calcular ROI <TrendingUp size={14} /></>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
