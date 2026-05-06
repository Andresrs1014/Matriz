// frontend/src/components/projects/EvidenceUploader.tsx
import { useCallback, useEffect, useState } from "react"
import { AnimatePresence } from "framer-motion"
import { Paperclip } from "lucide-react"
import EvidenceDropzone, { type PendingFile } from "./EvidenceDropzone"
import EvidenceCard from "./EvidenceCard"
import { useEvidence } from "@/hooks/useEvidence"
import { useEvidenceEventStore } from "@/store/evidenceEventStore"
import { toast } from "@/store/toastStore"
import type { Evidence } from "@/types/evidence"

interface PendingModeProps {
  mode: "pending"
  files: PendingFile[]
  onChange: (files: PendingFile[]) => void
}

interface LiveModeProps {
  mode: "live"
  projectId: number
  canUpload: boolean
  canDelete: (evidence: Evidence) => boolean
}

type Props = PendingModeProps | LiveModeProps

export default function EvidenceUploader(props: Props) {
  if (props.mode === "pending") {
    return <PendingUploader files={props.files} onChange={props.onChange} />
  }
  return <LiveUploader projectId={props.projectId} canUpload={props.canUpload} canDelete={props.canDelete} />
}

function PendingUploader({ files, onChange }: { files: PendingFile[]; onChange: (files: PendingFile[]) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        <Paperclip className="h-3.5 w-3.5 text-electric" />
        Evidencias iniciales
      </div>
      <EvidenceDropzone files={files} onChange={onChange} />
    </div>
  )
}

function LiveUploader({
  projectId,
  canUpload,
  canDelete,
}: {
  projectId: number
  canUpload: boolean
  canDelete: (evidence: Evidence) => boolean
}) {
  const { listEvidence, uploadEvidence, deleteEvidence, downloadEvidenceFile, loading } = useEvidence()
  const [evidences, setEvidences] = useState<Evidence[]>([])
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const { lastEvent } = useEvidenceEventStore()

  const fetch = useCallback(async () => {
    const data = await listEvidence(projectId)
    setEvidences(data)
  }, [listEvidence, projectId])

  useEffect(() => {
    fetch()
  }, [fetch])

  useEffect(() => {
    if (lastEvent && lastEvent.projectId === projectId) {
      fetch()
    }
  }, [lastEvent, projectId, fetch])

  const handleUpload = useCallback(
    async (file: File, description?: string) => {
      const ev = await uploadEvidence(projectId, file, description, (p) => {
        setUploadProgress((prev) => ({ ...prev, [file.name]: p }))
      })
      if (ev) {
        toast.success(`Evidencia subida: ${ev.filename}`)
        setUploadProgress((prev) => {
          const next = { ...prev }
          delete next[file.name]
          return next
        })
        fetch()
      }
    },
    [uploadEvidence, projectId, fetch]
  )

  const handleDelete = useCallback(
    async (evidence: Evidence): Promise<boolean> => {
      if (
        !window.confirm(
          `¿Eliminar “${evidence.filename}”? Desaparecerá de la lista (borrado lógico en el sistema).`
        )
      ) {
        return false
      }
      const ok = await deleteEvidence(projectId, evidence.id)
      if (ok) {
        toast.success("Evidencia eliminada")
        fetch()
      }
      return ok
    },
    [deleteEvidence, projectId, fetch]
  )

  const handleDownload = useCallback(
    async (evidence: Evidence) => {
      try {
        await downloadEvidenceFile(projectId, evidence.id, evidence.filename)
      } catch (err: any) {
        const msg =
          typeof err?.response?.data?.detail === "string"
            ? err.response.data.detail
            : "No se pudo descargar el archivo."
        toast.error(msg)
      }
    },
    [downloadEvidenceFile, projectId]
  )

  return (
    <div className="scroll-mt-28 space-y-4" id="evidencias">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Paperclip className="h-3.5 w-3.5 text-electric" />
          Evidencias y avances
        </div>
        {evidences.length > 0 && (
          <span className="text-[11px] text-slate-500">{evidences.length} archivos</span>
        )}
      </div>

      {canUpload && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-3">
          <EvidenceDropzone
            files={[]}
            onChange={(files) => {
              const valid = files.filter((f) => !f.error)
              valid.forEach((f) => handleUpload(f.file))
            }}
          />
          {Object.entries(uploadProgress).map(([name, p]) => (
            <div key={name} className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="truncate">{name}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-electric transition-all"
                  style={{ width: `${p}%` }}
                />
              </div>
              <span className="shrink-0">{p}%</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {evidences.length === 0 && !loading && (
          <p className="py-6 text-center text-xs text-slate-600">
            No hay evidencias aún.
          </p>
        )}
        <AnimatePresence>
          {evidences.map((ev) => (
            <EvidenceCard
              key={ev.id}
              evidence={ev}
              canDelete={canDelete(ev)}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
