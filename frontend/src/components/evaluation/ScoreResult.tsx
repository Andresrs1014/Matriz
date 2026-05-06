import { motion } from "framer-motion"
import { CheckCircle, TrendingUp, Zap } from "lucide-react"
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useNavigate } from "react-router-dom"

interface ScoreResultProps {
  impactScore: number
  effortScore: number
  quadrant:    QuadrantKey
  projectName: string
  onClose:     () => void
}

export default function ScoreResult({ impactScore, effortScore, quadrant, projectName, onClose }: ScoreResultProps) {
  const config = QUADRANT_CONFIG[quadrant]
  const navigate = useNavigate()

  function handleGoToMatrix() {
    onClose()
    setTimeout(() => navigate("/matrix"), 200)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, type: "spring" }}
      className="space-y-6 text-center"
    >
      {/* Ícono de éxito */}
      <div className="flex justify-center">
        <div className={cn("w-16 h-16 rounded-2xl border flex items-center justify-center", config.bgClass, config.glowClass)}>
          <CheckCircle size={32} className={config.textClass} />
        </div>
      </div>

      <div>
        <p className="text-slate-400 text-sm">Proyecto evaluado</p>
        <h3 className="text-white text-lg font-semibold mt-1">{projectName}</h3>
      </div>

      {/* Cuadrante asignado */}
      <div className={cn("mx-auto w-fit px-6 py-3 rounded-xl border", config.bgClass, config.glowClass)}>
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Cuadrante asignado</p>
        <p className={cn("text-2xl font-bold", config.textClass)}>{config.label}</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">{config.description}</p>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-4">
          <div className="flex items-center gap-2 justify-center mb-1">
            <TrendingUp size={14} className="text-cyan-400" />
            <span className="text-xs text-slate-400">Impacto</span>
          </div>
          <p className="text-2xl font-bold text-cyan-400">{impactScore.toFixed(0)}<span className="text-sm text-slate-500">/100</span></p>
        </div>
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-4">
          <div className="flex items-center gap-2 justify-center mb-1">
            <Zap size={14} className="text-indigo-400" />
            <span className="text-xs text-slate-400">Esfuerzo</span>
          </div>
          <p className="text-2xl font-bold text-indigo-400">{effortScore.toFixed(0)}<span className="text-sm text-slate-500">/100</span></p>
        </div>
      </div>

      <button
        onClick={handleGoToMatrix}
        className="w-full py-3 px-6 rounded-lg bg-electric text-white font-medium text-sm hover:bg-electric-bright shadow-glow-blue transition-all"
      >
        Ver en la Matriz
      </button>
    </motion.div>
  )
}
