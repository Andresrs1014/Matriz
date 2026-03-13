// frontend/src/components/matrix/MatrixMiniPlot.tsx
// Mini scatter plot 2x2 (impacto vs esfuerzo) embebido en el detalle del proyecto
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface Props {
  impactScore: number
  effortScore: number
  quadrant: QuadrantKey
}

const QUADRANT_LABELS = [
  { key: "esencial",    label: "Esencial",    x: "left",  y: "top" },
  { key: "estrategico", label: "Estratégico", x: "right", y: "top" },
  { key: "indiferente", label: "Indiferente", x: "left",  y: "bottom" },
  { key: "lujo",        label: "Lujo",        x: "right", y: "bottom" },
]

export default function MatrixMiniPlot({ impactScore, effortScore, quadrant }: Props) {
  const config = QUADRANT_CONFIG[quadrant]

  // Convertir scores (0-100) a posición % en el grid
  // X = esfuerzo (0=izquierda=bajo, 100=derecha=alto)
  // Y = impacto  (0=abajo=bajo, 100=arriba=alto)
  const xPct = effortScore    // esfuerzo → eje X
  const yPct = 100 - impactScore  // impacto invertido → eje Y (CSS top)

  return (
    <div className="space-y-3">
      {/* Grid */}
      <div className="relative w-full aspect-square max-h-48 bg-slate-900/60 rounded-xl border border-slate-700/50 overflow-hidden">

        {/* Líneas divisorias */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 border-r border-slate-700/40" />
          <div className="flex-1" />
        </div>
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-1 border-b border-slate-700/40" />
          <div className="flex-1" />
        </div>

        {/* Labels cuadrantes */}
        {QUADRANT_LABELS.map((q) => {
          const qConf = QUADRANT_CONFIG[q.key as QuadrantKey]
          const isActive = q.key === quadrant
          return (
            <div key={q.key}
              className={cn(
                "absolute px-2 py-1 text-[10px] font-medium rounded transition-all",
                q.x === "left" ? "left-2" : "right-2",
                q.y === "top" ? "top-2" : "bottom-2",
                isActive
                  ? cn(qConf.color, "opacity-100")
                  : "text-slate-700 opacity-60"
              )}>
              {q.label}
            </div>
          )
        })}

        {/* Punto del proyecto */}
        <div
          className={cn(
            "absolute w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all",
            config.dotClass ?? "bg-electric"
          )}
          style={{
            left: `calc(${xPct}% - 8px)`,
            top: `calc(${yPct}% - 8px)`,
          }}
        />
      </div>

      {/* Ejes */}
      <div className="flex justify-between text-[10px] text-slate-600 px-1">
        <span>← Bajo esfuerzo</span>
        <span>Alto esfuerzo →</span>
      </div>
    </div>
  )
}
