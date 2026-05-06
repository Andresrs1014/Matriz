import { useState } from "react"
import { motion } from "framer-motion"
import { ROI_QUADRANT_CONFIG } from "@/types/roi"
import type { ROIPlotPoint } from "@/types/roi"

interface Props {
  points:     ROIPlotPoint[]
  selectedId: number | null
  onSelect:   (p: ROIPlotPoint) => void
}


const W   = 560
const H   = 480
const PAD = 48

const HORAS_UMBRAL    = 4          // línea horizontal al 50 % de 8 h
const VALOR_UMBRAL    = 250_000    // línea vertical al 50 % de 500 K
const MAX_VALOR_SCALE = 500_000    // escala fija eje X: 0–500 K COP
const MAX_HORAS_SCALE = 8          // escala fija eje Y: 0–8 h

const LABEL_STYLE = {
  fontSize: 11,
  fontWeight: 700,
  fill: "#64748b",
  letterSpacing: "0.08em"
}

const QUAD_COLORS = {
  proceso_pesado:   { fill: "rgba(251,191,36,0.04)",  stroke: "rgba(251,191,36,0.12)"  },
  alto_impacto:     { fill: "rgba(52,211,153,0.05)",  stroke: "rgba(52,211,153,0.15)"  },
  bajo_impacto:     { fill: "rgba(148,163,184,0.03)", stroke: "rgba(148,163,184,0.08)" },
  eficiencia_menor: { fill: "rgba(129,140,248,0.04)", stroke: "rgba(129,140,248,0.12)" },
}

function scoreToX(score: number) { return PAD + (score / 100) * (W - PAD * 2) }
function scoreToY(score: number) { return H - PAD - (score / 100) * (H - PAD * 2) }

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0
  }).format(n)
}

function fmtTick(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${Math.round(v / 1_000)}K`
  return `${v}`
}

export default function ROIMatrixPlot({ points, selectedId, onSelect }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)

  // Escala fija — las líneas nunca se mueven independientemente de los datos
  const maxValor = MAX_VALOR_SCALE
  const maxHoras = MAX_HORAS_SCALE

  const umbralXScore = (VALOR_UMBRAL / maxValor) * 100
  const umbralYScore = (HORAS_UMBRAL / maxHoras) * 100
  const umbralXpx    = scoreToX(umbralXScore)
  const umbralYpx    = scoreToY(umbralYScore)

  const xTicks = Array.from({ length: 6 }, (_, i) =>
    Math.round((maxValor / 5) * i)
  )
  const yTicks = Array.from({ length: 6 }, (_, i) =>
    parseFloat(((maxHoras / 5) * i).toFixed(1))
  )

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-2xl mx-auto"
        style={{ minWidth: 320 }}
        overflow="visible"
      >
        {/* ── Fondos de cuadrante ── */}
        <rect x={PAD} y={PAD} width={umbralXpx - PAD} height={umbralYpx - PAD} fill={QUAD_COLORS.proceso_pesado.fill} stroke={QUAD_COLORS.proceso_pesado.stroke} strokeWidth={1} rx={8} />
        <rect x={umbralXpx} y={PAD} width={W - umbralXpx - PAD} height={umbralYpx - PAD} fill={QUAD_COLORS.alto_impacto.fill} stroke={QUAD_COLORS.alto_impacto.stroke} strokeWidth={1} rx={8} />
        <rect x={PAD} y={umbralYpx} width={umbralXpx - PAD} height={H - umbralYpx - PAD} fill={QUAD_COLORS.bajo_impacto.fill} stroke={QUAD_COLORS.bajo_impacto.stroke} strokeWidth={1} rx={8} />
        <rect x={umbralXpx} y={umbralYpx} width={W - umbralXpx - PAD} height={H - umbralYpx - PAD} fill={QUAD_COLORS.eficiencia_menor.fill} stroke={QUAD_COLORS.eficiencia_menor.stroke} strokeWidth={1} rx={8} />

        {/* ── Ejes con glow azul ── */}
        <line x1={umbralXpx} y1={PAD - 10} x2={umbralXpx} y2={H - PAD + 10} stroke="#3b82f6" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 4px rgba(59,130,246,0.7))" }} />
        <line x1={PAD - 10} y1={umbralYpx} x2={W - PAD + 10} y2={umbralYpx} stroke="#3b82f6" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 4px rgba(59,130,246,0.7))" }} />

        {/* Flechas de ejes */}
        <polygon points={`${umbralXpx},${PAD - 18} ${umbralXpx - 5},${PAD - 8} ${umbralXpx + 5},${PAD - 8}`} fill="#3b82f6" />
        <polygon points={`${umbralXpx},${H - PAD + 18} ${umbralXpx - 5},${H - PAD + 8} ${umbralXpx + 5},${H - PAD + 8}`} fill="#3b82f6" />
        <polygon points={`${W - PAD + 18},${umbralYpx} ${W - PAD + 8},${umbralYpx - 5} ${W - PAD + 8},${umbralYpx + 5}`} fill="#3b82f6" />
        <polygon points={`${PAD - 18},${umbralYpx} ${PAD - 8},${umbralYpx - 5} ${PAD - 8},${umbralYpx + 5}`} fill="#3b82f6" />

        {/* Labels de ejes */}
        <text x={W / 2} y={20} textAnchor="middle" {...LABEL_STYLE} fill="#94a3b8">ALTO AHORRO</text>
        <text x={W / 2} y={H - 8} textAnchor="middle" {...LABEL_STYLE} fill="#94a3b8">BAJO AHORRO</text>
        <text x={16} y={H / 2 + 4} textAnchor="middle" {...LABEL_STYLE} fill="#94a3b8" transform={`rotate(-90, 16, ${H / 2})`}>BAJO VALOR</text>
        <text x={W - 16} y={H / 2 + 4} textAnchor="middle" {...LABEL_STYLE} fill="#94a3b8" transform={`rotate(90, ${W - 16}, ${H / 2})`}>ALTO VALOR</text>

        {/* Labels de cuadrantes */}
        {/* (Eliminados duplicados de labels de cuadrantes) */}

        {/* ── Flechas de ejes ── */}
        <polygon points={`${umbralXpx},${PAD - 18} ${umbralXpx - 5},${PAD - 8} ${umbralXpx + 5},${PAD - 8}`}    fill="#3b82f6" />
        <polygon points={`${umbralXpx},${H - PAD + 18} ${umbralXpx - 5},${H - PAD + 8} ${umbralXpx + 5},${H - PAD + 8}`} fill="#3b82f6" />
        <polygon points={`${W - PAD + 18},${umbralYpx} ${W - PAD + 8},${umbralYpx - 5} ${W - PAD + 8},${umbralYpx + 5}`} fill="#3b82f6" />
        <polygon points={`${PAD - 18},${umbralYpx} ${PAD - 8},${umbralYpx - 5} ${PAD - 8},${umbralYpx + 5}`}    fill="#3b82f6" />

        {/* ── Labels de ejes ── */}
        {/* (Eliminados duplicados de labels de ejes) */}

        {/* ── Labels de cuadrantes — centrados en cada cuadrante ── */}
        <text x={(PAD + umbralXpx) / 2}     y={PAD + 22} textAnchor="middle" fontSize={11} fontWeight={700} fill="rgba(251,191,36,0.6)">PROCESO PESADO</text>
        <text x={(umbralXpx + W - PAD) / 2} y={PAD + 22} textAnchor="middle" fontSize={11} fontWeight={700} fill="rgba(52,211,153,0.6)">ALTO IMPACTO</text>
        <text x={(PAD + umbralXpx) / 2}     y={H - PAD - 10} textAnchor="middle" fontSize={11} fontWeight={700} fill="rgba(148,163,184,0.5)">BAJO IMPACTO</text>
        <text x={(umbralXpx + W - PAD) / 2} y={H - PAD - 10} textAnchor="middle" fontSize={11} fontWeight={700} fill="rgba(129,140,248,0.6)">EFICIENCIA MENOR</text>

        {/* ── Ticks eje X (Valor COP) ── */}
        {xTicks.map((v) => {
          const x = scoreToX((v / maxValor) * 100)
          return (
            <g key={`xt-${v}`}>
              <line x1={x} y1={H - PAD} x2={x} y2={H - PAD + 4} stroke="#374151" />
              <text x={x} y={H - PAD + 14} textAnchor="middle" fontSize="8" fill="#475569">{fmtTick(v)}</text>
            </g>
          )
        })}

        {/* ── Ticks eje Y (Horas ahorradas) ── */}
        {yTicks.map((v) => {
          const y = scoreToY((v / maxHoras) * 100)
          return (
            <g key={`yt-${v}`}>
              <line x1={PAD - 4} y1={y} x2={PAD} y2={y} stroke="#374151" />
              <text x={PAD - 6} y={y + 3} textAnchor="end" fontSize="8" fill="#475569">{v}h</text>
            </g>
          )
        })}

        {/* ── Burbujas ── */}
        {points.map((p, i) => {
          const xScore   = (p.roi_valor_total  / maxValor) * 100
          const yScore   = (p.horas_ahorradas  / maxHoras) * 100
          const x        = scoreToX(Math.min(xScore, 98))
          const y        = scoreToY(Math.min(Math.max(yScore, 2), 98))
          const c        = ROI_QUADRANT_CONFIG[p.cuadrante_roi] ?? ROI_QUADRANT_CONFIG.bajo_impacto
          const isHov    = hovered === i
          const isSel    = p.roi_id === selectedId

          return (
            <motion.g
              key={p.roi_id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 300 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(p)}
              style={{ cursor: "pointer" }}
            >
              {/* Glow hover */}
              {isHov && (
                <circle cx={x} cy={y} r={20} fill={c.color} opacity="0.15"
                  style={{ filter: `drop-shadow(0 0 8px ${c.color})` }} />
              )}

              {/* Ring seleccionado */}
              {isSel && (
                <circle cx={x} cy={y} r={17} fill="none" stroke="#6366f1" strokeWidth={2}
                  style={{ filter: "drop-shadow(0 0 6px #6366f1)" }} />
              )}

              {/* Burbuja principal */}
              <circle cx={x} cy={y} r={13}
                fill={c.color} opacity={isHov || isSel ? 0.95 : 0.8}
                style={isHov ? { filter: `drop-shadow(0 0 6px ${c.color})` } : undefined}
              />

              {/* Inicial */}
              <text x={x} y={y + 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="700">
                {p.project_title.charAt(0).toUpperCase()}
              </text>

              {/* Tooltip hover — se ajusta para no salir del SVG */}
              {isHov && (
                <foreignObject
                  x={x - 100 < PAD ? PAD : x + 100 > W - PAD ? W - PAD - 200 : x - 100}
                  y={y - 108 < PAD ? y + 20 : y - 108}
                  width="200" height="105"
                >
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
                    <p style={{ color: "#94a3b8", fontSize: 9, marginBottom: 1 }}>
                      Proceso: <span style={{ color: "white" }}>{p.horas_proceso_actual}h</span>
                      &nbsp;·&nbsp;Personas: <span style={{ color: "white" }}>{p.num_personas}</span>
                    </p>
                    <p style={{ color: "#94a3b8", fontSize: 9 }}>
                      Ahorro: <span style={{ color: "#34d399" }}>{fmtCOP(p.roi_valor_total)}</span>
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
