import { useState } from "react"
import { motion } from "framer-motion"
import { ROI_QUADRANT_CONFIG } from "@/types/roi"
import type { ROIPlotPoint } from "@/types/roi"

interface Props {
  points: ROIPlotPoint[]
}

// Dimensiones del canvas SVG
const W = 560
const H = 460
const PAD = { top: 24, right: 24, bottom: 52, left: 60 }
const PW  = W - PAD.left - PAD.right   // plot width
const PH  = H - PAD.top  - PAD.bottom  // plot height

// Umbrales — deben coincidir con el backend
const PAYBACK_UMBRAL = 26   // semanas
const ROI_UMBRAL     = 100  // %

// Cuadrante labels posicionados en cada zona
const QUAD_LABELS = [
  { key: "rentable_rapido", x: PAD.left + PW * 0.12, y: PAD.top + PH * 0.12 },
  { key: "rentable_lento",  x: PAD.left + PW * 0.60, y: PAD.top + PH * 0.12 },
  { key: "dudoso_rapido",   x: PAD.left + PW * 0.12, y: PAD.top + PH * 0.78 },
  { key: "no_justificado",  x: PAD.left + PW * 0.60, y: PAD.top + PH * 0.78 },
] as const

function computeRanges(points: ROIPlotPoint[]) {
  const maxPayback = Math.max(...points.map((p) => Math.min(p.payback_semanas, 200)), PAYBACK_UMBRAL * 2)
  const maxROI     = Math.max(...points.map((p) => p.roi_pct), ROI_UMBRAL * 2)
  const xMax = Math.ceil(maxPayback / 20) * 20 + 20
  const yMax = Math.ceil(maxROI     / 100) * 100
  return { xMax: Math.max(xMax, 80), yMax: Math.max(yMax, 300) }
}

function toX(payback: number, xMax: number)  { return PAD.left + (payback / xMax) * PW }
function toY(roi: number,     yMax: number)  { return PAD.top  + PH - (roi / yMax) * PH }

export default function ROIMatrixPlot({ points }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  const { xMax, yMax } = points.length > 0
    ? computeRanges(points)
    : { xMax: 80, yMax: 300 }

  const divX = toX(PAYBACK_UMBRAL, xMax)
  const divY = toY(ROI_UMBRAL, yMax)

  // Ticks del eje X (payback en semanas)
  const xTicks = Array.from({ length: 5 }, (_, i) => Math.round((xMax / 4) * i))
  // Ticks del eje Y (ROI %)
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i))

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: W, display: "block", margin: "0 auto" }}
      >
        {/* Cuadrantes coloreados */}
        {/* Rentable Rápido: top-left */}
        <rect x={PAD.left} y={PAD.top} width={divX - PAD.left} height={divY - PAD.top} className="fill-emerald-500/8" />
        {/* Rentable Lento: top-right */}
        <rect x={divX} y={PAD.top} width={PAD.left + PW - divX} height={divY - PAD.top} className="fill-blue-500/8" />
        {/* Dudoso Rápido: bottom-left */}
        <rect x={PAD.left} y={divY} width={divX - PAD.left} height={PAD.top + PH - divY} className="fill-amber-500/8" />
        {/* No justificado: bottom-right */}
        <rect x={divX} y={divY} width={PAD.left + PW - divX} height={PAD.top + PH - divY} className="fill-rose-500/8" />

        {/* Borde del área de plot */}
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#1e2d4a" strokeWidth="1" />

        {/* Líneas divisoras (laser) */}
        <line x1={divX} y1={PAD.top} x2={divX} y2={PAD.top + PH} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
        <line x1={PAD.left} y1={divY} x2={PAD.left + PW} y2={divY} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />

        {/* Etiquetas de cuadrantes */}
        {QUAD_LABELS.map(({ key, x, y }) => {
          const c = ROI_QUADRANT_CONFIG[key]
          return (
            <g key={key}>
              <text x={x} y={y}   textAnchor="middle" className="text-[9px]" fontSize="9" fill={c.color} opacity="0.7" fontWeight="600">
                {c.label.toUpperCase()}
              </text>
              <text x={x} y={y + 13} textAnchor="middle" fontSize="8" fill={c.color} opacity="0.45">
                {c.action}
              </text>
            </g>
          )
        })}

        {/* Ticks y labels eje X (Payback) */}
        {xTicks.map((v) => {
          const x = toX(v, xMax)
          return (
            <g key={`xt-${v}`}>
              <line x1={x} y1={PAD.top + PH} x2={x} y2={PAD.top + PH + 4} stroke="#374151" />
              <text x={x} y={PAD.top + PH + 14} textAnchor="middle" fontSize="9" fill="#64748b">
                {v}s
              </text>
            </g>
          )
        })}

        {/* Ticks y labels eje Y (ROI %) */}
        {yTicks.map((v) => {
          const y = toY(v, yMax)
          return (
            <g key={`yt-${v}`}>
              <line x1={PAD.left - 4} y1={y} x2={PAD.left} y2={y} stroke="#374151" />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                {v}%
              </text>
            </g>
          )
        })}

        {/* Título eje X */}
        <text x={PAD.left + PW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#475569">
          ← Payback más rápido · Semanas de recuperación · Payback más lento →
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
          ROI %
        </text>

        {/* Umbral labels */}
        <text x={divX + 4} y={PAD.top + 10} fontSize="8" fill="#3b82f6" opacity="0.7">26s</text>
        <text x={PAD.left + 4} y={divY - 4} fontSize="8" fill="#3b82f6" opacity="0.7">100%</text>

        {/* Burbujas de proyectos */}
        {points.map((p, i) => {
          const x = toX(Math.min(p.payback_semanas, xMax * 0.98), xMax)
          const y = toY(Math.min(Math.max(p.roi_pct, 0), yMax * 0.98), yMax)
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
              {/* Glow */}
              {isHovered && (
                <circle cx={x} cy={y} r={18} fill={c.color} opacity="0.15" />
              )}
              {/* Círculo */}
              <circle cx={x} cy={y} r={12} fill={c.color} opacity={isHovered ? 0.9 : 0.75} />
              {/* Inicial */}
              <text x={x} y={y + 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="700">
                {initial}
              </text>

              {/* Tooltip */}
              {isHovered && (
                <foreignObject x={x - 90} y={y - 90} width="180" height="80">
                  <div
                    style={{ background: "#0f1c2e", border: `1px solid ${c.color}40`, borderRadius: 8, padding: "8px 10px" }}
                  >
                    <p style={{ color: "white", fontSize: 11, fontWeight: 600, marginBottom: 3 }}>{p.project_title}</p>
                    <p style={{ color: c.color, fontSize: 10, marginBottom: 1 }}>{c.label}</p>
                    <p style={{ color: "#64748b", fontSize: 9 }}>
                      ROI: {p.roi_pct.toFixed(1)}% · Payback: {p.payback_semanas.toFixed(0)}s
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
