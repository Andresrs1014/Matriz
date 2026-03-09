import { useState } from "react"
import { motion } from "framer-motion"
import { ROI_QUADRANT_CONFIG } from "@/types/roi"
import type { ROIPlotPoint } from "@/types/roi"

interface Props {
  points: ROIPlotPoint[]
}

// ── Canvas — igual que MatrixPlot ─────────────────────────────────────────────
const W   = 560
const H   = 480
const PAD = 48

// Centro exacto del SVG — siempre centrado como MatrixPlot
// const cx = W / 2
// const cy = H / 2

// ── Normalización de scores a 0–100 para posicionar burbujas ─────────────────
// Eje X: roi_pct  → umbral en 50% → mapeamos al centro
// Eje Y: horas_ahorradas → umbral en 4h → mapeamos al centro
// Estrategia: normalizar cada punto relativo al umbral para que el umbral = 50 score
// function normalizeX(roi_pct: number, maxRoi: number): number {
//   // roi_pct / maxRoi * 100  → escala 0-100 donde maxRoi = borde derecho
//   return Math.min((roi_pct / maxRoi) * 100, 99)
// }

// function normalizeY(horas: number, maxHoras: number): number {
//   return Math.min((horas / maxHoras) * 100, 99)
// }

function scoreToX(score: number) { return PAD + (score / 100) * (W - PAD * 2) }
function scoreToY(score: number) { return H - PAD - (score / 100) * (H - PAD * 2) }

// maxRoi = 2 * umbral (100%) → umbral queda justo en el centro
// maxHoras = 2 * umbral (8h) → umbral queda justo en el centro
const ROI_PCT_UMBRAL = 50
const HORAS_UMBRAL   = 4
const MAX_ROI_SCALE  = ROI_PCT_UMBRAL * 2   // 100% → umbral en centro
const MAX_HORAS_SCALE = HORAS_UMBRAL * 2    // 8h   → umbral en centro

const LABEL_STYLE = { fontSize: 11, fontWeight: 700, fill: "#64748b", letterSpacing: "0.08em" } as const

// Colores por cuadrante para los fondos
const QUAD_COLORS = {
  proceso_pesado:   { fill: "rgba(251,191,36,0.04)",  stroke: "rgba(251,191,36,0.12)"  },  // top-left
  alto_impacto:     { fill: "rgba(52,211,153,0.05)",  stroke: "rgba(52,211,153,0.15)"  },  // top-right
  bajo_impacto:     { fill: "rgba(148,163,184,0.03)", stroke: "rgba(148,163,184,0.08)" },  // bot-left
  eficiencia_menor: { fill: "rgba(129,140,248,0.04)", stroke: "rgba(129,140,248,0.12)" },  // bot-right
}

export default function ROIMatrixPlot({ points }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  // Calcular el máximo real para escalar correctamente cuando hay valores > umbral*2
  const maxRoi   = Math.max(...points.map(p => p.roi_pct),   MAX_ROI_SCALE)
  const maxHoras = Math.max(...points.map(p => p.horas_ahorradas), MAX_HORAS_SCALE)

  // Valores en px de los umbrales (siempre centro porque maxRoi = al menos umbral*2)
  const umbralXScore = (ROI_PCT_UMBRAL / maxRoi) * 100
  const umbralYScore = (HORAS_UMBRAL   / maxHoras) * 100
  const umbralXpx = scoreToX(umbralXScore)
  const umbralYpx = scoreToY(umbralYScore)

  // Ticks del eje X (roi_pct %)
  const xTickCount = 5
  const xTicks = Array.from({ length: xTickCount + 1 }, (_, i) =>
    parseFloat(((maxRoi / xTickCount) * i).toFixed(1))
  )
  // Ticks del eje Y (horas ahorradas)
  const yTickCount = 5
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) =>
    parseFloat(((maxHoras / yTickCount) * i).toFixed(1))
  )

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-2xl mx-auto"
        style={{ minWidth: 320 }}
      >
        {/* ── Fondos de cuadrante con stroke — igual que MatrixPlot ── */}
        {/* proceso_pesado: top-left (roi bajo, horas altas) */}
        <rect
          x={PAD} y={PAD}
          width={umbralXpx - PAD} height={umbralYpx - PAD}
          fill={QUAD_COLORS.proceso_pesado.fill}
          stroke={QUAD_COLORS.proceso_pesado.stroke}
          strokeWidth={1} rx={8}
        />
        {/* alto_impacto: top-right (roi alto, horas altas) */}
        <rect
          x={umbralXpx} y={PAD}
          width={W - umbralXpx - PAD} height={umbralYpx - PAD}
          fill={QUAD_COLORS.alto_impacto.fill}
          stroke={QUAD_COLORS.alto_impacto.stroke}
          strokeWidth={1} rx={8}
        />
        {/* bajo_impacto: bot-left (roi bajo, horas bajas) */}
        <rect
          x={PAD} y={umbralYpx}
          width={umbralXpx - PAD} height={H - umbralYpx - PAD}
          fill={QUAD_COLORS.bajo_impacto.fill}
          stroke={QUAD_COLORS.bajo_impacto.stroke}
          strokeWidth={1} rx={8}
        />
        {/* eficiencia_menor: bot-right (roi alto, horas bajas) */}
        <rect
          x={umbralXpx} y={umbralYpx}
          width={W - umbralXpx - PAD} height={H - umbralYpx - PAD}
          fill={QUAD_COLORS.eficiencia_menor.fill}
          stroke={QUAD_COLORS.eficiencia_menor.stroke}
          strokeWidth={1} rx={8}
        />

        {/* ── Ejes con glow azul — igual que MatrixPlot ── */}
        {/* Eje vertical en el umbral X */}
        <line
          x1={umbralXpx} y1={PAD - 10}
          x2={umbralXpx} y2={H - PAD + 10}
          stroke="#3b82f6" strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 0 4px rgba(59,130,246,0.7))" }}
        />
        {/* Eje horizontal en el umbral Y */}
        <line
          x1={PAD - 10} y1={umbralYpx}
          x2={W - PAD + 10} y2={umbralYpx}
          stroke="#3b82f6" strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 0 4px rgba(59,130,246,0.7))" }}
        />

        {/* ── Flechas de ejes — igual que MatrixPlot ── */}
        {/* Arriba */}
        <polygon points={`${umbralXpx},${PAD - 18} ${umbralXpx - 5},${PAD - 8} ${umbralXpx + 5},${PAD - 8}`} fill="#3b82f6" />
        {/* Abajo */}
        <polygon points={`${umbralXpx},${H - PAD + 18} ${umbralXpx - 5},${H - PAD + 8} ${umbralXpx + 5},${H - PAD + 8}`} fill="#3b82f6" />
        {/* Derecha */}
        <polygon points={`${W - PAD + 18},${umbralYpx} ${W - PAD + 8},${umbralYpx - 5} ${W - PAD + 8},${umbralYpx + 5}`} fill="#3b82f6" />
        {/* Izquierda */}
        <polygon points={`${PAD - 18},${umbralYpx} ${PAD - 8},${umbralYpx - 5} ${PAD - 8},${umbralYpx + 5}`} fill="#3b82f6" />

        {/* ── Labels de ejes — igual que MatrixPlot ── */}
        <text x={umbralXpx} y={12}      textAnchor="middle" {...LABEL_STYLE}>ALTO AHORRO</text>
        <text x={umbralXpx} y={H - 4}   textAnchor="middle" {...LABEL_STYLE}>BAJO AHORRO</text>
        <text x={8}         y={umbralYpx + 4} textAnchor="middle" {...LABEL_STYLE}
          transform={`rotate(-90, 8, ${umbralYpx})`}>BAJO ROI</text>
        <text x={W - 8}     y={umbralYpx + 4} textAnchor="middle" {...LABEL_STYLE}
          transform={`rotate(90, ${W - 8}, ${umbralYpx})`}>ALTO ROI</text>

        {/* ── Labels de cuadrantes ── */}
        <text x={PAD + 10}       y={PAD + 22} fontSize={12} fontWeight={700} fill="rgba(251,191,36,0.6)">PROCESO PESADO</text>
        <text x={umbralXpx + 10} y={PAD + 22} fontSize={12} fontWeight={700} fill="rgba(52,211,153,0.6)">ALTO IMPACTO</text>
        <text x={PAD + 10}       y={H - PAD - 10} fontSize={12} fontWeight={700} fill="rgba(148,163,184,0.5)">BAJO IMPACTO</text>
        <text x={umbralXpx + 10} y={H - PAD - 10} fontSize={12} fontWeight={700} fill="rgba(129,140,248,0.6)">EFICIENCIA MENOR</text>

        {/* ── Ticks sutiles eje X (roi_pct) ── */}
        {xTicks.map((v) => {
          const score = (v / maxRoi) * 100
          const x = scoreToX(score)
          return (
            <g key={`xt-${v}`}>
              <line x1={x} y1={H - PAD} x2={x} y2={H - PAD + 4} stroke="#374151" />
              <text x={x} y={H - PAD + 14} textAnchor="middle" fontSize="8" fill="#475569">{v}%</text>
            </g>
          )
        })}

        {/* ── Ticks sutiles eje Y (horas ahorradas) ── */}
        {yTicks.map((v) => {
          const score = (v / maxHoras) * 100
          const y = scoreToY(score)
          return (
            <g key={`yt-${v}`}>
              <line x1={PAD - 4} y1={y} x2={PAD} y2={y} stroke="#374151" />
              <text x={PAD - 6} y={y + 3} textAnchor="end" fontSize="8" fill="#475569">{v}h</text>
            </g>
          )
        })}

        {/* ── Burbujas de proyectos ── */}
        {points.map((p, i) => {
          const xScore = (p.roi_pct        / maxRoi)   * 100
          const yScore = (p.horas_ahorradas / maxHoras) * 100
          const x = scoreToX(Math.min(xScore, 98))
          const y = scoreToY(Math.min(Math.max(yScore, 2), 98))
          const c = ROI_QUADRANT_CONFIG[p.cuadrante_roi]
          const isHovered = hovered === i

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
              {isHovered && (
                <circle cx={x} cy={y} r={20}
                  fill={c.color} opacity="0.15"
                  style={{ filter: `drop-shadow(0 0 8px ${c.color})` }}
                />
              )}
              <circle cx={x} cy={y} r={13}
                fill={c.color} opacity={isHovered ? 0.95 : 0.8}
                style={isHovered ? { filter: `drop-shadow(0 0 6px ${c.color})` } : undefined}
              />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="700">
                {p.project_title.charAt(0).toUpperCase()}
              </text>

              {isHovered && (
                <foreignObject x={x - 100} y={y - 105} width="200" height="100">
                  <div style={{
                    background: "#0f1c2e",
                    border: `1px solid ${c.color}50`,
                    borderRadius: 8,
                    padding: "8px 10px",
                    boxShadow: `0 4px 20px ${c.color}20`
                  }}>
                    <p style={{ color: "white",   fontSize: 11, fontWeight: 600, marginBottom: 3 }}>{p.project_title}</p>
                    <p style={{ color: c.color,   fontSize: 10, marginBottom: 4 }}>{c.label} · {c.action}</p>
                    <p style={{ color: "#94a3b8", fontSize: 9, marginBottom: 1 }}>
                      ROI: <span style={{ color: "white" }}>{p.roi_pct.toFixed(1)}%</span>
                      &nbsp;·&nbsp;Ahorro: <span style={{ color: "white" }}>{p.horas_ahorradas.toFixed(1)}h</span>
                    </p>
                    <p style={{ color: "#94a3b8", fontSize: 9 }}>
                      Proceso: <span style={{ color: "white" }}>{p.horas_proceso_actual}h</span>
                      &nbsp;·&nbsp;Personas: <span style={{ color: "white" }}>{p.num_personas}</span>
                    </p>
                  </div>
                </foreignObject>
              )}
            </motion.g>
          )
        })}

        {/* Estado vacío */}
        {points.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="#475569">
            No hay evaluaciones ROI registradas
          </text>
        )}
      </svg>
    </div>
  )
}
