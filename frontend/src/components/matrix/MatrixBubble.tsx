import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { MatrixPlotPoint } from "@/types/matrix"

interface MatrixBubbleProps {
  point:  MatrixPlotPoint
  x:      number   // px dentro del SVG
  y:      number   // px dentro del SVG
  index:  number
}

export default function MatrixBubble({ point, x, y, index }: MatrixBubbleProps) {
  const [hovered, setHovered] = useState(false)
  const config = QUADRANT_CONFIG[point.quadrant as QuadrantKey]

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Anillo de glow animado */}
      <motion.circle
        r={20}
        fill="none"
        stroke={config.color}
        strokeWidth={1}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: hovered ? 0.4 : 0.15, scale: hovered ? 1.3 : 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Burbuja principal */}
      <motion.circle
        r={14}
        fill={config.color}
        fillOpacity={0.85}
        stroke={config.color}
        strokeWidth={1.5}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.08, type: "spring", bounce: 0.4 }}
        whileHover={{ scale: 1.15 }}
      />

      {/* Inicial del proyecto */}
      <motion.text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontWeight="700"
        fill="white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.08 + 0.2 }}
      >
        {point.project_title.charAt(0).toUpperCase()}
      </motion.text>

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <foreignObject x={16} y={-48} width={180} height={80} style={{ overflow: "visible" }}>
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass-card px-3 py-2 text-xs pointer-events-none"
              style={{ width: 180 }}
            >
              <p className={cn("font-semibold mb-0.5", config.textClass)}>{config.label}</p>
              <p className="text-white text-[11px] leading-snug truncate">{point.project_title}</p>
              <p className="text-slate-400 mt-1">
                Impacto: <span className="text-cyan-400">{point.impact_score.toFixed(0)}</span>
                {" · "}
                Esfuerzo: <span className="text-indigo-400">{point.effort_score.toFixed(0)}</span>
              </p>
            </motion.div>
          </foreignObject>
        )}
      </AnimatePresence>
    </g>
  )
}
