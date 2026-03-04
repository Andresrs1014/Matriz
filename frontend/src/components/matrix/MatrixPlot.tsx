import { useMemo } from "react"
import { motion } from "framer-motion"
import MatrixBubble from "./MatrixBubble"
import type { MatrixPlotPoint } from "@/types/matrix"
import type { FilterType } from "./MatrixFilters"

interface MatrixPlotProps {
  points: MatrixPlotPoint[]
  filter: FilterType
}

const W = 560   // ancho SVG
const H = 480   // alto SVG
const PAD = 48  // padding interno

// Convierte score 0-100 a coordenada px dentro del área de dibujo
function scoreToX(effort: number)  { return PAD + (effort  / 100) * (W - PAD * 2) }
function scoreToY(impact: number)  { return H - PAD - (impact / 100) * (H - PAD * 2) }

const LABEL_STYLE = { fontSize: 11, fontWeight: 700, fill: "#64748b", letterSpacing: "0.08em" }

export default function MatrixPlot({ points, filter }: MatrixPlotProps) {
  const visible = useMemo(() =>
    filter === "all" ? points : points.filter((p) => p.quadrant === filter),
    [points, filter]
  )

  const cx = W / 2   // centro X (esfuerzo 50)
  const cy = H / 2   // centro Y (impacto 50)

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-2xl mx-auto"
        style={{ minWidth: 320 }}
      >
        {/* ── Fondos de cuadrante ───────────────────────────── */}
        {/* Esencial: alto impacto, bajo esfuerzo (arriba izq) */}
        <rect x={PAD} y={PAD} width={cx - PAD} height={cy - PAD}
          fill="rgba(34,211,238,0.04)" stroke="rgba(34,211,238,0.12)" strokeWidth={1} rx={8} />
        {/* Estratégico: alto impacto, alto esfuerzo (arriba der) */}
        <rect x={cx} y={PAD} width={W - cx - PAD} height={cy - PAD}
          fill="rgba(129,140,248,0.04)" stroke="rgba(129,140,248,0.12)" strokeWidth={1} rx={8} />
        {/* Indiferente: bajo impacto, bajo esfuerzo (abajo izq) */}
        <rect x={PAD} y={cy} width={cx - PAD} height={H - cy - PAD}
          fill="rgba(148,163,184,0.03)" stroke="rgba(148,163,184,0.08)" strokeWidth={1} rx={8} />
        {/* Lujo: bajo impacto, alto esfuerzo (abajo der) */}
        <rect x={cx} y={cy} width={W - cx - PAD} height={H - cy - PAD}
          fill="rgba(248,113,113,0.04)" stroke="rgba(248,113,113,0.10)" strokeWidth={1} rx={8} />

        {/* ── Ejes (líneas sable) ───────────────────────────── */}
        {/* Eje vertical */}
        <line x1={cx} y1={PAD - 10} x2={cx} y2={H - PAD + 10}
          stroke="#3b82f6" strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 0 4px rgba(59,130,246,0.7))" }} />
        {/* Eje horizontal */}
        <line x1={PAD - 10} y1={cy} x2={W - PAD + 10} y2={cy}
          stroke="#3b82f6" strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 0 4px rgba(59,130,246,0.7))" }} />

        {/* ── Flechas de ejes ───────────────────────────────── */}
        {/* Arriba */}
        <polygon points={`${cx},${PAD - 18} ${cx - 5},${PAD - 8} ${cx + 5},${PAD - 8}`} fill="#3b82f6" />
        {/* Abajo */}
        <polygon points={`${cx},${H - PAD + 18} ${cx - 5},${H - PAD + 8} ${cx + 5},${H - PAD + 8}`} fill="#3b82f6" />
        {/* Derecha */}
        <polygon points={`${W - PAD + 18},${cy} ${W - PAD + 8},${cy - 5} ${W - PAD + 8},${cy + 5}`} fill="#3b82f6" />
        {/* Izquierda */}
        <polygon points={`${PAD - 18},${cy} ${PAD - 8},${cy - 5} ${PAD - 8},${cy + 5}`} fill="#3b82f6" />

        {/* ── Labels de ejes ────────────────────────────────── */}
        <text x={cx} y={12}        textAnchor="middle" {...LABEL_STYLE}>ALTO IMPACTO</text>
        <text x={cx} y={H - 4}     textAnchor="middle" {...LABEL_STYLE}>BAJO IMPACTO</text>
        <text x={8}  y={cy + 4}    textAnchor="middle" {...LABEL_STYLE}
          transform={`rotate(-90, 8, ${cy})`}>FÁCIL</text>
        <text x={W - 8} y={cy + 4} textAnchor="middle" {...LABEL_STYLE}
          transform={`rotate(90, ${W - 8}, ${cy})`}>DIFÍCIL</text>

        {/* ── Labels de cuadrantes ──────────────────────────── */}
        <text x={PAD + 10}      y={PAD + 22} fontSize={12} fontWeight={700} fill="rgba(34,211,238,0.6)">ESENCIAL</text>
        <text x={cx + 10}       y={PAD + 22} fontSize={12} fontWeight={700} fill="rgba(129,140,248,0.6)">ESTRATÉGICO</text>
        <text x={PAD + 10}      y={H - PAD - 10} fontSize={12} fontWeight={700} fill="rgba(148,163,184,0.5)">INDIFERENTE</text>
        <text x={cx + 10}       y={H - PAD - 10} fontSize={12} fontWeight={700} fill="rgba(248,113,113,0.6)">LUJO</text>

        {/* ── Burbujas de proyectos ─────────────────────────── */}
        {visible.map((point, i) => (
          <MatrixBubble
            key={point.project_id}
            point={point}
            x={scoreToX(point.effort_score)}
            y={scoreToY(point.impact_score)}
            index={i}
          />
        ))}

        {/* Estado vacío */}
        {visible.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="#475569">
            No hay proyectos en este filtro
          </text>
        )}
      </svg>
    </div>
  )
}
