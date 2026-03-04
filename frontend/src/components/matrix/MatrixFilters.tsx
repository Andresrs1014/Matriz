import { cn } from "@/lib/utils"
import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"

export type FilterType = "all" | QuadrantKey

interface MatrixFiltersProps {
  active:   FilterType
  onChange: (f: FilterType) => void
  counts:   Record<string, number>
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all",         label: "Todos"        },
  { key: "esencial",    label: "Esencial"     },
  { key: "estrategico", label: "Estratégico"  },
  { key: "indiferente", label: "Indiferente"  },
  { key: "lujo",        label: "Lujo"         },
]

export default function MatrixFilters({ active, onChange, counts }: MatrixFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map(({ key, label }) => {
        const isActive = active === key
        const config   = key !== "all" ? QUADRANT_CONFIG[key as QuadrantKey] : null
        const count    = key === "all"
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : (counts[key] ?? 0)

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
              isActive && config  ? `${config.bgClass} ${config.textClass} ${config.glowClass}` :
              isActive            ? "bg-electric/20 text-electric border-electric/40 shadow-glow-blue" :
                                    "bg-navy-800 text-slate-400 border-navy-600 hover:border-navy-500 hover:text-white"
            )}
          >
            {label}
            <span className={cn(
              "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
              isActive ? "bg-white/10" : "bg-navy-700"
            )}>
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
