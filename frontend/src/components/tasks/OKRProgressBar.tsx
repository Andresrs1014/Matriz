import { cn } from "@/lib/utils"
import type { ProjectProgress } from "@/types/task"

function barColor(pct: number): string {
  if (pct <= 33) return "bg-[#E31E24]"
  if (pct <= 66) return "bg-amber-400"
  if (pct < 100) return "bg-blue-500"
  return "bg-emerald-500"
}

export default function OKRProgressBar({
  progress,
  className,
}: {
  progress: ProjectProgress | undefined
  className?: string
}) {
  const pct = progress?.progress_pct ?? 0
  const total = progress?.total_tasks ?? 0
  const done = progress?.completed_tasks ?? 0

  return (
    <div className={cn("space-y-2", className)}>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", barColor(pct))}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <p className="text-xs text-slate-400">
        {total === 0 ? (
          "Sin tareas registradas aún"
        ) : (
          <>
            {done} de {total} tareas completadas · {pct}%
          </>
        )}
      </p>
    </div>
  )
}
