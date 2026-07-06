// frontend/src/components/projects/EvidenceDropzone.tsx
import { useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, X, FileCheck } from "lucide-react"
import { validateFile, formatBytes, EVIDENCE_MAX_BYTES } from "@/lib/evidence"

interface PendingFile {
  file: File
  id: string
  error?: string
}

interface EvidenceDropzoneProps {
  files: PendingFile[]
  onChange: (files: PendingFile[]) => void
}

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

export default function EvidenceDropzone({ files, onChange }: EvidenceDropzoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return
    const incoming: PendingFile[] = []
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i]
      const v = validateFile(f)
      incoming.push({ file: f, id: makeId(), error: v.ok ? undefined : v.error })
    }
    onChange([...files, ...incoming].slice(0, 5))
  }

  function removeFile(id: string) {
    onChange(files.filter((f) => f.id !== id))
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          addFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
          dragOver
            ? "border-electric/60 bg-electric/5"
            : "border-slate-700/50 bg-slate-900/30 hover:border-slate-600/60"
        }`}
      >
        <Upload className="mx-auto h-5 w-5 text-slate-500" />
        <p className="mt-2 text-xs text-slate-400">
          Arrastra archivos aquí o haz clic para seleccionar
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          Máximo 5 archivos, {formatBytes(EVIDENCE_MAX_BYTES)} cada uno (Excel, PDF, imágenes, Word, txt)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = "" }}
        />
      </div>

      <AnimatePresence>
        {files.map((pf) => (
          <motion.div
            key={pf.id}
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
              pf.error
                ? "border-red-500/30 bg-red-500/5"
                : "border-slate-700/50 bg-slate-900/40"
            }`}
          >
            {pf.error ? (
              <X className="h-4 w-4 shrink-0 text-red-400" />
            ) : (
              <FileCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-slate-300">{pf.file.name}</p>
              {pf.error ? (
                <p className="text-[11px] text-red-400">{pf.error}</p>
              ) : (
                <p className="text-[11px] text-slate-500">{formatBytes(pf.file.size)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeFile(pf.id)}
              className="rounded-md p-1 text-slate-500 transition-colors hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export type { PendingFile }
