import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface QuestionStepProps {
  question:    string
  axis:        "impact" | "effort"
  current:     number
  total:       number
  value:       number
  onChange:    (value: number) => void
}

const SCALE_LABELS: Record<number, string> = {
  1: "Muy bajo",
  2: "Bajo",
  3: "Medio",
  4: "Alto",
  5: "Muy alto",
}

const AXIS_CONFIG = {
  impact: { label: "Eje Impacto",  color: "text-cyan-400",   border: "border-cyan-500/40",   bg: "bg-cyan-500/10"   },
  effort: { label: "Eje Esfuerzo", color: "text-indigo-400", border: "border-indigo-500/40", bg: "bg-indigo-500/10" },
}

export default function QuestionStep({ question, axis, current, total, value, onChange }: QuestionStepProps) {
  const config = AXIS_CONFIG[axis]

  return (
    <motion.div
      key={current}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Eje + progreso */}
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border", config.color, config.border, config.bg)}>
          {config.label}
        </span>
        <span className="text-xs text-slate-500">{current} / {total}</span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full h-1 bg-navy-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-electric rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(current / total) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Pregunta */}
      <p className="text-white text-base font-medium leading-relaxed min-h-[3rem]">
        {question}
      </p>

      {/* Escala 1–5 */}
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-semibold transition-all duration-200",
              value === n
                ? "bg-electric/20 border-electric text-electric shadow-glow-blue scale-105"
                : "bg-navy-800 border-navy-600 text-slate-400 hover:border-electric/50 hover:text-white"
            )}
          >
            <span className="text-lg">{n}</span>
            <span className="text-[10px] font-normal text-center leading-tight hidden sm:block">
              {SCALE_LABELS[n]}
            </span>
          </button>
        ))}
      </div>

      {/* Label seleccionado en móvil */}
      {value > 0 && (
        <p className="text-center text-xs text-electric sm:hidden">
          Seleccionado: {SCALE_LABELS[value]}
        </p>
      )}
    </motion.div>
  )
}
