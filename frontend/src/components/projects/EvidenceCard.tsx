// frontend/src/components/projects/EvidenceCard.tsx
import { motion } from "framer-motion"
import { Download, Eye, Trash2 } from "lucide-react"
import { useState } from "react"
import EvidencePreviewModal from "./EvidencePreviewModal"
import { formatBytes, iconForExtension } from "@/lib/evidence"
import type { Evidence } from "@/types/evidence"

interface EvidenceCardProps {
  evidence: Evidence
  canDelete: boolean
  onDelete: (evidence: Evidence) => void
  onDownload: (evidence: Evidence) => void | Promise<void>
}

export default function EvidenceCard({ evidence, canDelete, onDelete, onDownload }: EvidenceCardProps) {
  const Icon = iconForExtension(evidence.extension)
  const [previewOpen, setPreviewOpen] = useState(false)

  const date = new Date(evidence.created_at).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/45 px-4 py-3 transition-colors hover:border-slate-600/60"
      >
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-800/60 text-slate-300 transition-colors hover:bg-slate-800 hover:text-electric"
          title="Ver en plataforma"
        >
          <Icon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="min-w-0 flex-1 cursor-pointer text-left"
          title="Ver en plataforma"
        >
          <p className="truncate text-sm font-medium text-slate-200">{evidence.filename}</p>
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
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            title="Ver en plataforma"
            className="rounded-md p-1.5 text-electric transition-colors hover:bg-slate-800/60 hover:text-electric-bright"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void onDownload(evidence)}
            title="Descargar copia"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
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

      <EvidencePreviewModal
        evidence={evidence}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onDownload={onDownload}
      />
    </>
  )
}
