import { motion } from "framer-motion"
import { TrendingUp, Clock, DollarSign, Users, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ROI_QUADRANT_CONFIG } from "@/types/roi"
import type { ROIRead } from "@/types/roi"

interface Props {
  roi: ROIRead
  onClose: () => void
}

function fmt$(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

function fmtNum(n: number, decimals = 1) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: decimals }).format(n)
}

export default function ROIResult({ roi, onClose }: Props) {
  const config = ROI_QUADRANT_CONFIG[roi.cuadrante_roi]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-5"
    >
      {/* Cuadrante */}
      <div className={cn("rounded-xl p-4 border text-center", config.bgClass, config.borderClass)}>
        <CheckCircle size={20} className={cn("mx-auto mb-2", config.textClass)} />
        <p className={cn("text-xl font-bold", config.textClass)}>{config.label}</p>
        <p className="text-xs text-slate-400 mt-1">
          Recomendación: <span className="font-semibold text-white">{config.action}</span>
        </p>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-navy-800 rounded-xl p-3 border border-navy-700">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={13} className="text-emerald-400" />
            <span className="text-[11px] text-slate-400">ROI</span>
          </div>
          <p className={cn("text-2xl font-bold", roi.roi_pct >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {fmtNum(roi.roi_pct)}
            <span className="text-sm text-slate-500">%</span>
          </p>
        </div>

        <div className="bg-navy-800 rounded-xl p-3 border border-navy-700">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={13} className="text-amber-400" />
            <span className="text-[11px] text-slate-400">Horas ahorradas</span>
          </div>
          <p className="text-base font-bold text-amber-400 leading-tight mt-1">
            {fmtNum(roi.horas_ahorradas)} h
          </p>
        </div>

        <div className="bg-navy-800 rounded-xl p-3 border border-navy-700">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={13} className="text-cyan-400" />
            <span className="text-[11px] text-slate-400">Ahorro total</span>
          </div>
          <p className="text-lg font-bold text-cyan-400">{fmt$(roi.roi_valor_total)}</p>
        </div>

        <div className="bg-navy-800 rounded-xl p-3 border border-navy-700">
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={13} className="text-indigo-400" />
            <span className="text-[11px] text-slate-400">Personas impactadas</span>
          </div>
          <p className="text-lg font-bold text-indigo-400">{roi.num_personas}</p>
        </div>
      </div>

      {/* Resumen de horas */}
      <div className="bg-navy-800/60 rounded-xl p-3 border border-navy-700 space-y-1.5 text-xs">
        <div className="flex justify-between text-slate-400">
          <span>Horas actuales del proceso</span>
          <span className="text-white font-medium">{fmtNum(roi.horas_proceso_actual)} h</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Horas proyectadas</span>
          <span className="text-white font-medium">{fmtNum(roi.horas_proyectadas)} h</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Valor hora hombre</span>
          <span className="text-white font-medium">{fmt$(roi.valor_hora_hombre)}</span>
        </div>
        <div className="border-t border-navy-600 pt-1.5 flex justify-between">
          <span className="text-slate-400">Ahorro total (horas × personas × valor/h)</span>
          <span className="text-emerald-400 font-semibold">{fmt$(roi.roi_valor_total)}</span>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full py-2.5 rounded-xl bg-electric/10 border border-electric/30 text-sm font-medium text-electric hover:bg-electric/20 transition-all"
      >
        Ver en la Matriz ROI
      </button>
    </motion.div>
  )
}
