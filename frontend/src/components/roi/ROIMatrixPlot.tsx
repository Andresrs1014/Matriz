import { useState } from "react"
import { motion } from "framer-motion"
import { ROI_QUADRANT_CONFIG } from "@/types/roi"
import type { ROIPlotPoint } from "@/types/roi"

interface Props {
  points: ROIPlotPoint[]
}

const W = 560
const H = 460
const PAD = { top: 24, right: 24, bottom: 52, left: 60 }
const PW = W - PAD.left - PAD.right
const PH = H - PAD.top - PAD.bottom

// Umbrales dinámicos desde los datos (percentil 50)
function computeRanges(points: ROIPlotPoint[]) {
  const maxX = Math.max(...points.map((p) => p.horas_proceso_actual), 10)
  const maxY = Math.max(...points.map((p) => p.horas_ahorradas), 5)
  const xMax = Math.ceil(maxX / 10) * 10 + 10
  const yMax = Math.ceil(maxY / 5) * 5 + 5
  // Umbrales en el punto medio del rango
  const xUmbral = xMax / 2
  const yUmbral = yMax / 2
  return { xMax, yMax, xUmbral, yUmbral }
}

function toX(val: number, xMax: number) { return PAD.left + (val / xMax) * PW }
function toY(val: number, yMax: number) { return PAD.top + PH - (val / yMax) * PH }

const QUAD_LABELS = [
  // alto_impacto: proceso liviano (X bajo) + mucho ahorro (Y alto)
  { key: "alto_impacto",     xFrac: 0.18, yFrac: 0.15 },
  // proceso_pesado: proceso pesado (X alto) + mucho ahorro (Y alto)
  { key: "proceso_pesado",   xFrac: 0.68, yFrac: 0.15 },
  // eficiencia_menor: proceso liviano (X bajo) + poco ahorro (Y bajo)
  { key: "eficiencia_menor", xFrac: 0.18, yFrac: 0.78 },
  // bajo_impacto: proceso pesado (X alto) + poco ahorro (Y bajo)
  { key: "bajo_impacto",     xFrac: 0.68, yFrac: 0.78 },
] as const

export default function ROIMatrixPlot({ points }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  const { xMax, yMax, xUmbral, yUmbral } =
    points.length > 0 ? computeRanges(points) : { xMax: 20, yMax: 10, xUmbral: 10, yUmbral: 5 }

  const divX = toX(xUmbral, xMax)
  const divY = toY(yUmbral, yMax)

  const xTicks = Array.from({ length: 5 }, (_, i) => Math.round((xMax / 4) * i))
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i))

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: W, display: "block", margin: "0 auto" }}
      >
        {/* Cuadrantes coloreados */}
        <rect x={PAD.left} y={PAD.top} width={divX - PAD.left} height={divY - PAD.top} className="fill-emerald-500/8" />
        <rect x={divX} y={PAD.top} width={PAD.left + PW - divX} height={divY - PAD.top} className="fill-blue-500/8" />
        <rect x={PAD.left} y={divY} width={divX - PAD.left} height={PAD.top + PH - divY} className="fill-amber-500/8" />
        <rect x={divX} y={divY} width={PAD.left + PW - divX} height={PAD.top + PH - divY} className="fill-rose-500/8" />

        {/* Borde del área */}
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#1e2d4a" strokeWidth="1" />

        {/* Líneas divisoras */}
        <line x1={divX} y1={PAD.top} x2={divX} y2={PAD.top + PH} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
        <line x1={PAD.left} y1={divY} x2={PAD.left + PW} y2={divY} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />

        {/* Etiquetas de cuadrantes */}
        {QUAD_LABELS.map(({ key, xFrac, yFrac }) => {
          const c = ROI_QUADRANT_CONFIG[key]
          const lx = PAD.left + PW * xFrac
          const ly = PAD.top + PH * yFrac
          return (
            <g key={key}>
              <text x={lx} y={ly} textAnchor="middle" fontSize="9" fill={c.color} opacity="0.7" fontWeight="600">
                {c.label.toUpperCase()}
              </text>
              <text x={lx} y={ly + 13} textAnchor="middle" fontSize="8" fill={c.color} opacity="0.45">
                {c.action}
              </text>
            </g>
          )
        })}

        {/* Ticks eje X (Horas proceso actual) */}
        {xTicks.map((v) => {
          const x = toX(v, xMax)
          return (
            <g key={`xt-${v}`}>
              <line x1={x} y1={PAD.top + PH} x2={x} y2={PAD.top + PH + 4} stroke="#374151" />
              <text x={x} y={PAD.top + PH + 14} textAnchor="middle" fontSize="9" fill="#64748b">{v}h</text>
            </g>
          )
        })}

        {/* Ticks eje Y (Horas ahorradas) */}
        {yTicks.map((v) => {
          const y = toY(v, yMax)
          return (
            <g key={`yt-${v}`}>
              <line x1={PAD.left - 4} y1={y} x2={PAD.left} y2={y} stroke="#374151" />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">{v}h</text>
            </g>
          )
        })}

        {/* Título eje X */}
        <text x={PAD.left + PW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#475569">
          ← Proceso liviano · Horas actuales del proceso · Proceso pesado →
        </text>

        {/* Título eje Y */}
        <text
          x={14}
          y={PAD.top + PH / 2}
          textAnchor="middle"
          fontSize="10"
          fill="#475569"
          transform={`rotate(-90, 14, ${PAD.top + PH / 2})`}
        >
          Horas ahorradas
        </text>

        {/* Umbral labels */}
        <text x={divX + 4} y={PAD.top + 10} fontSize="8" fill="#3b82f6" opacity="0.7">{xUmbral}h</text>
        <text x={PAD.left + 4} y={divY - 4} fontSize="8" fill="#3b82f6" opacity="0.7">{yUmbral}h</text>

        {/* Burbujas */}
        {points.map((p, i) => {
          const x = toX(Math.min(p.horas_proceso_actual, xMax * 0.98), xMax)
          const y = toY(Math.min(Math.max(p.horas_ahorradas, 0), yMax * 0.98), yMax)
          const c = ROI_QUADRANT_CONFIG[p.cuadrante_roi]
          const isHovered = hovered === i
          const initial = p.project_title.charAt(0).toUpperCase()

          return (
            <motion.g
              key={p.roi_id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 300 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              {isHovered && <circle cx={x} cy={y} r={18} fill={c.color} opacity="0.15" />}
              <circle cx={x} cy={y} r={12} fill={c.color} opacity={isHovered ? 0.9 : 0.75} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="700">{initial}</text>

              {isHovered && (
                <foreignObject x={x - 95} y={y - 95} width="190" height="90">
                  <div style={{ background: "#0f1c2e", border: `1px solid ${c.color}40`, borderRadius: 8, padding: "8px 10px" }}>
                    <p style={{ color: "white", fontSize: 11, fontWeight: 600, marginBottom: 3 }}>{p.project_title}</p>
                    <p style={{ color: c.color, fontSize: 10, marginBottom: 1 }}>{c.label}</p>
                    <p style={{ color: "#64748b", fontSize: 9 }}>
                      Proceso: {p.horas_proceso_actual}h · Ahorro: {p.horas_ahorradas.toFixed(1)}h · ROI: {p.roi_pct.toFixed(1)}%
                    </p>
                  </div>
                </foreignObject>
              )}
            </motion.g>
          )
        })}
      </svg>
    </div>
  )
}
