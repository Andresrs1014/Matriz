import { useEffect, useState } from "react"
import { Loader2, Mail, Send } from "lucide-react"
import { useSMTPConfig, useTestSMTP, useUpsertSMTP } from "@/hooks/useSMTP"
import { toast } from "@/store/toastStore"
import type { SMTPConfigUpsert } from "@/types/smtp"
import { cn } from "@/lib/utils"

const emptyForm = (): Omit<SMTPConfigUpsert, "password"> & { password: string } => ({
  host: "",
  port: 587,
  username: "",
  password: "",
  use_tls: true,
  from_name: "Matriz ZYMO",
  notification_email: "",
})

export default function SMTPConfigForm() {
  const { data: config, loading, error, refetch } = useSMTPConfig()
  const { mutate: upsert, isPending: saving, error: saveErr } = useUpsertSMTP()
  const { mutate: testSmtp, isPending: testing, error: testErr } = useTestSMTP()

  const [form, setForm] = useState(emptyForm())

  useEffect(() => {
    if (!config) return
    setForm({
      host: config.host,
      port: config.port,
      username: config.username,
      password: "",
      use_tls: config.use_tls,
      from_name: config.from_name,
      notification_email: config.notification_email,
    })
  }, [config])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!config && !form.password.trim()) {
      toast.error("Introduce la contraseña SMTP en el primer guardado.")
      return
    }
    const payload: SMTPConfigUpsert = {
      host: form.host.trim(),
      port: Number(form.port),
      username: form.username.trim(),
      use_tls: form.use_tls,
      from_name: form.from_name.trim(),
      notification_email: form.notification_email.trim(),
      password: form.password.trim(),
    }
    const row = await upsert(payload, () => {
      void refetch()
    })
    if (row) {
      toast.success("Configuración guardada")
      setForm((f) => ({ ...f, password: "" }))
    } else if (saveErr) toast.error(saveErr)
  }

  async function handleTest() {
    const r = await testSmtp()
    if (r?.ok) toast.success(`Correo de prueba enviado a ${r.sent_to}`)
    else if (testErr) toast.error(testErr)
    else toast.error("No se pudo enviar la prueba.")
  }

  const hasConfig = Boolean(config)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <Mail className="h-4 w-4 text-electric" /> Servidor de correo (SMTP)
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            La contraseña no se muestra nunca. Si dejas el campo vacío al guardar, se mantiene la actual.
          </p>
        </div>
        <span
          className={cn(
            "text-[11px] font-medium px-2.5 py-1 rounded-full border",
            hasConfig ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-amber-400 border-amber-500/35 bg-amber-500/10"
          )}
        >
          {loading ? "Cargando…" : hasConfig ? "Configuración guardada" : "Sin configurar"}
        </span>
      </div>

      {(error || saveErr || testErr) && !loading && (
        <div className="text-xs text-red-400 border border-red-500/25 rounded-lg px-3 py-2">
          {error ?? saveErr ?? testErr}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-electric" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="md:col-span-2 text-xs text-slate-400">
            Host SMTP
            <input
              required
              value={form.host}
              onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm focus:outline-none focus:border-electric"
              placeholder="smtp.ejemplo.com"
            />
          </label>
          <label className="text-xs text-slate-400">
            Puerto
            <input
              type="number"
              required
              min={1}
              max={65535}
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm focus:outline-none focus:border-electric"
            />
          </label>
          <label className="text-xs text-slate-400 flex items-center gap-2 mt-6 md:mt-8">
            <input
              type="checkbox"
              checked={form.use_tls}
              onChange={(e) => setForm((f) => ({ ...f, use_tls: e.target.checked }))}
              className="rounded border-navy-600"
            />
            Usar TLS (STARTTLS)
          </label>
          <label className="text-xs text-slate-400">
            Usuario (cuenta SMTP)
            <input
              required
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm focus:outline-none focus:border-electric"
              autoComplete="off"
            />
          </label>
          <label className="text-xs text-slate-400">
            Contraseña
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={hasConfig && config?.has_password ? "Dejar vacío para no cambiar" : "Obligatoria la primera vez"}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm focus:outline-none focus:border-electric"
              autoComplete="new-password"
            />
          </label>
          <label className="text-xs text-slate-400">
            Nombre del remitente
            <input
              required
              value={form.from_name}
              onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm focus:outline-none focus:border-electric"
            />
          </label>
          <label className="text-xs text-slate-400">
            Email de notificación
            <input
              type="email"
              required
              value={form.notification_email}
              onChange={(e) => setForm((f) => ({ ...f, notification_email: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm focus:outline-none focus:border-electric"
            />
          </label>
          <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-electric text-navy-950 text-sm font-semibold hover:bg-electric-bright disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Guardar configuración
            </button>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || !hasConfig}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-electric/35 bg-electric/10 text-electric text-sm font-medium hover:bg-electric/20 disabled:opacity-40"
              title={!hasConfig ? "Guarda la configuración antes de probar" : undefined}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar email de prueba
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
