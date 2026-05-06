/** Respuesta GET `/settings/smtp` (sin contraseña; coincide con `SMTPConfigRead` del backend). */
export interface SMTPConfig {
  id: number
  host: string
  port: number
  username: string
  use_tls: boolean
  from_name: string
  notification_email: string
  updated_at: string
  has_password: boolean
}

export interface SMTPConfigUpsert {
  host: string
  port: number
  username: string
  password: string
  use_tls: boolean
  from_name: string
  notification_email: string
}
