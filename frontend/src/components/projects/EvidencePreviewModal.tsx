// frontend/src/components/projects/EvidencePreviewModal.tsx
import { useEffect, useState } from "react"
import api from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getEvidencePreviewKind } from "@/lib/evidence"
import type { Evidence } from "@/types/evidence"

interface EvidencePreviewModalProps {
  evidence: Evidence | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload: (evidence: Evidence) => void | Promise<void>
  /** Si puedes borrar esta evidencia, muestra acción en el pie del modal */
  canDelete?: boolean
  /** Sin argumentos: ya está ligada al archivo del modal */
  onDelete?: () => void | Promise<void>
}

export default function EvidencePreviewModal({
  evidence,
  open,
  onOpenChange,
  onDownload,
  canDelete = false,
  onDelete,
}: EvidencePreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [textBody, setTextBody] = useState<string | null>(null)

  const kind = evidence ? getEvidencePreviewKind(evidence) : "none"

  useEffect(() => {
    if (!open || !evidence) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setTextBody(null)
      setLoadError(null)
      setLoading(false)
      return
    }

    if (kind === "office" || kind === "none") {
      setLoading(false)
      setLoadError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setTextBody(null)

    api
      .get(`/projects/${evidence.project_id}/evidence/${evidence.id}/download`, {
        responseType: "blob",
      })
      .then(async ({ data }) => {
        if (cancelled) return
        if (kind === "text") {
          setTextBody(await data.text())
        } else {
          const url = URL.createObjectURL(data)
          setBlobUrl(url)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("No se pudo cargar la vista previa.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, evidence?.id, evidence?.project_id, kind])

  if (!evidence) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden border-slate-700 bg-slate-900 p-0 text-slate-100 sm:rounded-xl">
        <DialogHeader className="border-b border-slate-700/80 px-5 py-4 pr-12">
          <DialogTitle className="truncate text-left text-base font-semibold text-white">
            {evidence.filename}
          </DialogTitle>
          <p className="text-left text-xs text-slate-500">
            Vista en plataforma ·{" "}
            {kind === "office"
              ? "Este formato se abre con Excel o Word en tu equipo."
              : kind === "none"
                ? "Vista previa no disponible para este tipo de archivo."
                : "Usa “Descargar” solo si necesitas una copia local."}
          </p>
        </DialogHeader>

        <div className="min-h-[200px] flex-1 overflow-auto px-2 py-4 sm:px-4">
          {loading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-electric/30 border-t-electric" />
            </div>
          )}
          {!loading && loadError && (
            <p className="py-12 text-center text-sm text-red-400">{loadError}</p>
          )}

          {!loading && !loadError && kind === "image" && blobUrl && (
            <div className="flex justify-center">
              <img
                src={blobUrl}
                alt={evidence.filename}
                className="max-h-[75vh] max-w-full rounded-lg object-contain"
              />
            </div>
          )}

          {!loading && !loadError && kind === "pdf" && blobUrl && (
            <iframe
              title={evidence.filename}
              src={blobUrl}
              className="h-[75vh] w-full rounded-lg border border-slate-700/80 bg-slate-950"
            />
          )}

          {!loading && !loadError && kind === "text" && textBody !== null && (
            <pre className="max-h-[75vh] overflow-auto rounded-lg border border-slate-700/60 bg-slate-950/80 p-4 font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-wrap break-words">
              {textBody}
            </pre>
          )}

          {!loading && !loadError && kind === "office" && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="max-w-sm text-sm text-slate-400">
                Excel y Word no tienen visor integrado en la plataforma. Puedes revisar el
                archivo en tu equipo después de descargarlo.
              </p>
            </div>
          )}

          {!loading && !loadError && kind === "none" && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="max-w-sm text-sm text-slate-400">
                Este tipo de archivo no se puede previsualizar aquí. Usa descargar si lo
                necesitas.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 border-t border-slate-700/80 bg-slate-900/95 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cerrar
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={() => void onDelete()}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20"
              >
                Eliminar evidencia
              </button>
            )}
            <button
              type="button"
              onClick={() => void onDownload(evidence)}
              className="rounded-lg bg-electric/90 px-4 py-2 text-sm font-medium text-white hover:bg-electric"
            >
              Descargar copia
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
