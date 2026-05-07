export type CommentTipo =
  | "comentario"
  | "cambio_estado"
  | "feedback"
  | "aprobacion"
  | "actualizacion"
  | "extension_fecha"

export interface Comment {
  id:          number
  project_id:  number
  author_id:   number
  author_role: string
  author_name: string
  message:     string
  tipo:        CommentTipo
  created_at:  string
}
