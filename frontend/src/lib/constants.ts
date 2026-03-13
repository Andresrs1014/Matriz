export const QUADRANT_CONFIG = {
  esencial: {
    label:       "Esencial",
    description: "Alto impacto, fácil de implementar. Prioridad máxima.",
    color:       "#22d3ee",
    bgClass:     "bg-cyan-500/10 border-cyan-500/30",
    textClass:   "text-cyan-400",
    glowClass:   "shadow-[0_0_20px_rgba(34,211,238,0.3)]",
    dotClass:    "bg-cyan-400",
  },
  estrategico: {
    label:       "Estratégico",
    description: "Alto impacto, difícil de implementar. Planificar bien.",
    color:       "#818cf8",
    bgClass:     "bg-indigo-500/10 border-indigo-500/30",
    textClass:   "text-indigo-400",
    glowClass:   "shadow-[0_0_20px_rgba(129,140,248,0.3)]",
    dotClass:    "bg-indigo-400",
  },
  indiferente: {
    label:       "Indiferente",
    description: "Bajo impacto, fácil de implementar. Evaluar valor real.",
    color:       "#94a3b8",
    bgClass:     "bg-slate-500/10 border-slate-500/30",
    textClass:   "text-slate-400",
    glowClass:   "shadow-[0_0_20px_rgba(148,163,184,0.2)]",
    dotClass:    "bg-slate-400",
  },
  lujo: {
    label:       "Lujo",
    description: "Bajo impacto, difícil de implementar. ¿Es realmente necesario?",
    color:       "#f87171",
    bgClass:     "bg-red-500/10 border-red-500/30",
    textClass:   "text-red-400",
    glowClass:   "shadow-[0_0_20px_rgba(248,113,113,0.3)]",
    dotClass:    "bg-red-400",
  },
} as const

export type QuadrantKey = keyof typeof QUADRANT_CONFIG

export const API_BASE = "/api"
export const WS_URL   = import.meta.env.VITE_WS_URL ?? "ws://127.0.0.1:8000/ws"
