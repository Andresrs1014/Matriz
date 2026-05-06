// frontend/src/types/evidence.ts
export interface Evidence {
  id: number
  project_id: number
  uploaded_by: number
  uploader_name: string
  uploader_role: string
  filename: string
  mime_type: string
  extension: string
  size_bytes: number
  sha256: string
  description: string | null
  created_at: string
  download_url: string | null
}

export interface EvidenceUploadInput {
  file: File
  description?: string | null
}
