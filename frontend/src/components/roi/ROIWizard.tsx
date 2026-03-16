import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Users, Clock, TrendingUp, Loader2, ChevronRight } from "lucide-react"
import type { ROIRead } from "@/types/roi"
import { useROI } from "@/hooks/useROI"
import ROIResult from "@/components/roi/ROIResult"

interface Props {
  projectId: number
  projectName: string
  onClose: () => void
}

// ── Parte 1 — datos del jefe ──────────────────────────────────────────────────
interface Parte1State {
  cargo: string
  sede: string
  num_personas: string
  salario_base: string
}

// ── Parte 2 — proyección del analista ────────────────────────────────────────
interface Parte2State {
  horas_proceso_actual: string
  horas_proyectadas: string
}

const SEDES = ["LOGIMAT", "LOGIMAT B2", "IMC CARGO", "IMC DEPOSITO"]

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
          type="text" inputMode="decimal" value={value}
          onChange={(e) => {
            const val = e.target.value
            if (/^\d*\.?\d*$/.test(val)) onChange(val)
          }}
          className="w-full bg-navy-800 border border-navy-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white
            placeholder-slate-600 focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric/30"
        />
      </div>
    </div>
  )
}

export default function ROIWizard({ projectId, projectName, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [parte1, setParte1] = useState<Parte1State>({ cargo: "", sede: "", num_personas: "", salario_base: "" })
  const [parte2, setParte2] = useState<Parte2State>({ horas_proceso_actual: "", horas_proyectadas: "" })
  const [result, setResult] = useState<ROIRead | null>(null)
  const { submitting, submitROIParte1, submitROIParte2 } = useROI(projectId)

  function setParte1Field(field: keyof Parte1State) {
    return (v: string) => setParte1((prev) => ({ ...prev, [field]: v }))
  }

  function isParte1Valid() {
    return (
      parte1.cargo.trim() !== "" &&
      parte1.sede !== "" &&
      Number(parte1.num_personas) >= 1 &&
      Number(parte1.salario_base) > 0
    )
  }

  function isParte2Valid() {
    const actual = Number(parte2.horas_proceso_actual)
    const proyectadas = Number(parte2.horas_proyectadas)
    return actual > 0 && proyectadas >= 0 && proyectadas < actual
  }

  async function handleParte1() {
    if (!isParte1Valid()) return
    // Avanza al paso 2 — parte1 se envía junto con parte2 al final
    setStep(2)
  }

  async function handleParte2() {
    if (!isParte2Valid()) return
    try {
      // Enviar Parte 1 primero
      await submitROIParte1({
        cargo: parte1.cargo,
        sede: parte1.sede,
        num_personas: Number(parte1.num_personas),
        salario_base: Number(parte1.salario_base),
      })
      // Luego Parte 2 con el recalculo
      const roi = await submitROIParte2({
        horas_proceso_actual: Number(parte2.horas_proceso_actual),
        horas_proyectadas: Number(parte2.horas_proyectadas),
      })
      setResult(roi)
    } catch {
      // error manejado por interceptor axios
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              <span className="text-sm font-semibold text-white">Evaluación ROI</span>
              {!result && (
                <span className="text-xs text-slate-500 bg-navy-800 px-2 py-0.5 rounded-full">
                  Paso {step} de 2
                </span>
              )}
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
          ) : step === 1 ? (
            <motion.div key="parte1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-6 space-y-5"
            >
              {/* Indicador paso */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Users size={13} className="text-electric" />
                <span className="uppercase tracking-wider font-semibold text-slate-300">Datos económicos</span>
              </div>

              {/* Cargo */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Cargo de la persona evaluada</label>
                <input
                  type="text" value={parte1.cargo}
                  onChange={(e) => setParte1Field("cargo")(e.target.value)}
                  placeholder="Ej: Coordinador de Compras"
                  className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white
                    placeholder-slate-600 focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric/30"
                />
              </div>

              {/* Sede */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Sede</label>
                <select
                  value={parte1.sede}
                  onChange={(e) => setParte1Field("sede")(e.target.value)}
                  className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white
                    focus:outline-none focus:border-electric focus:ring-1 focus:ring-electric/30"
                >
                  <option value="">Seleccionar sede...</option>
                  {SEDES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Número de personas */}
              <NumericField
                label="Número de personas que realizan el proceso"
                value={parte1.num_personas}
                unit="#"
                onChange={setParte1Field("num_personas")}
              />

              {/* Salario */}
              <NumericField
                label="Salario base mensual"
                hint="El sistema calculará automáticamente quincena, día y hora hombre"
                value={parte1.salario_base}
                unit="$"
                onChange={setParte1Field("salario_base")}
              />

              <div className="flex gap-3 pt-2">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-navy-600 text-sm text-slate-400 hover:text-white hover:border-navy-500 transition-all">
                  Cancelar
                </button>
                <button onClick={handleParte1} disabled={!isParte1Valid()}
                  className="flex-1 py-2.5 rounded-xl bg-electric/90 hover:bg-electric text-sm font-semibold text-white
                    transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  Continuar <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>

          ) : (
            <motion.div key="parte2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-6 space-y-5"
            >
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock size={13} className="text-amber-400" />
                <span className="uppercase tracking-wider font-semibold text-slate-300">Proyección de horas</span>
              </div>

              <NumericField
                label="Horas actuales del proceso"
                hint="¿Cuántas horas tarda el proceso HOY?"
                value={parte2.horas_proceso_actual}
                unit="h"
                onChange={(v) => setParte2((p) => ({ ...p, horas_proceso_actual: v }))}
              />

              <NumericField
                label="Horas proyectadas tras automatización"
                hint="¿Cuántas horas tardará DESPUÉS? Debe ser menor a las actuales"
                value={parte2.horas_proyectadas}
                unit="h"
                onChange={(v) => setParte2((p) => ({ ...p, horas_proyectadas: v }))}
              />

              {/* Preview del ahorro */}
              {isParte2Valid() && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-400">
                  ✓ Se ahorrarán <strong>{(Number(parte2.horas_proceso_actual) - Number(parte2.horas_proyectadas)).toFixed(1)} horas</strong> por ejecución del proceso
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-2.5 rounded-xl border border-navy-600 text-sm text-slate-400 hover:text-white hover:border-navy-500 transition-all">
                  Atrás
                </button>
                <button onClick={handleParte2} disabled={!isParte2Valid() || submitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500/90 hover:bg-emerald-500 text-sm font-semibold text-white
                    transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
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
