// frontend/src/components/projects/EvidenceCard.tsx
import { motion } from "framer-motion"
import { Download, Trash2 } from "lucide-react"
import { formatBytes, iconForExtension } from "@/lib/evidence"
import type { Evidence } from "@/types/evidence"

interface EvidenceCardProps {
  evidence: Evidence
  canDelete: boolean
  onDelete: (evidence: Evidence) => void
  onDownload: (evidence: Evidence) => void
}

export default function EvidenceCard({ evidence, canDelete, onDelete, onDownload }: EvidenceCardProps) {
  const Icon = iconForExtension(evidence.extension)
  const date = new Date(evidence.created_at).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="relative flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/45 px-4 py-3 transition-colors hover:border-slate-600/60"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/60 text-slate-300">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-200" title={evidence.filename}>
          {evidence.filename}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
          <span>{formatBytes(evidence.size_bytes)}</span>
          <span className="text-slate-700">·</span>
          <span>{evidence.uploader_name}</span>
          <span className="text-slate-700">·</span>
          <span>{date}</span>
        </div>
        {evidence.description && (
          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{evidence.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onDownload(evidence)}
          title="Descargar"
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-electric"
        >
          <Download className="h-4 w-4" />
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(evidence)}
            title="Eliminar"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </motion.div>
  )
}
