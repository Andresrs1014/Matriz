// frontend/src/lib/evidence.ts
import {
  FileSpreadsheet,
  FileText,
  Image,
  FileType,
  type LucideIcon,
} from "lucide-react"

export const EVIDENCE_ALLOWED_EXTS = new Set([
  "xlsx", "xls", "csv",
  "pdf",
  "jpg", "jpeg", "png", "gif", "webp",
  "txt", "doc", "docx", "rtf", "md",
])

export const EVIDENCE_MAX_BYTES = 20 * 1024 * 1024

export function validateFile(file: File): { ok: true } | { ok: false; error: string } {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (!ext) return { ok: false, error: "El archivo no tiene extensión." }
  if (!EVIDENCE_ALLOWED_EXTS.has(ext)) {
    return { ok: false, error: `Extensión '.${ext}' no permitida.` }
  }
  if (file.size > EVIDENCE_MAX_BYTES) {
    return { ok: false, error: `El archivo excede ${formatBytes(EVIDENCE_MAX_BYTES)}.` }
  }
  return { ok: true }
}

export function formatBytes(n: number): string {
  if (n === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${parseFloat((n / k ** i).toFixed(1))} ${sizes[i]}`
}

/** Qué tipo de vista previa podemos mostrar en la app (sin descargar obligatoriamente). */
export type EvidencePreviewKind = "image" | "pdf" | "text" | "office" | "none"

export function getEvidencePreviewKind(ev: {
  mime_type: string
  extension: string
}): EvidencePreviewKind {
  const ext = ev.extension.toLowerCase()
  const mime = ev.mime_type.toLowerCase()
  if (mime.startsWith("image/")) return "image"
  if (mime === "application/pdf" || ext === "pdf") return "pdf"
  if (
    mime.startsWith("text/") ||
    ext === "txt" ||
    ext === "md" ||
    ext === "csv" ||
    mime === "text/csv" ||
    mime === "text/markdown" ||
    mime === "text/plain"
  ) {
    return "text"
  }
  if (["xlsx", "xls", "doc", "docx", "rtf"].includes(ext)) return "office"
  return "none"
}

export function iconForExtension(ext: string): LucideIcon {
  switch (ext.toLowerCase()) {
    case "xlsx":
    case "xls":
    case "csv":
      return FileSpreadsheet
    case "pdf":
    case "txt":
    case "doc":
    case "docx":
    case "rtf":
    case "md":
      return FileText
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return Image
    default:
      return FileType
  }
}
