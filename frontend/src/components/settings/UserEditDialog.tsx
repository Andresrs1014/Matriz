import { useEffect, useState } from "react"
import { Loader2, Pencil } from "lucide-react"
import api from "@/lib/api"
import type { User } from "@/types/auth"
import type { CatalogRow } from "@/types/catalog"
import { toast } from "@/store/toastStore"
import { cn } from "@/lib/utils"

type Props = {
  user: User
  onClose: () => void
  onSaved: () => void
}

function detailMessage(e: unknown): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof d === "string") return d
  if (Array.isArray(d)) return d.map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x))).join(", ")
  return "Error al guardar."
}

export default function UserEditDialog({ user, onClose, onSaved }: Props) {
  const [areas, setAreas] = useState<CatalogRow[]>([])
  const [sites, setSites] = useState<CatalogRow[]>([])
  const [email, setEmail] = useState(user.email)
  const [fullName, setFullName] = useState(user.full_name ?? "")
  const [workAreaId, setWorkAreaId] = useState<number | "">(user.work_area_id ?? "")
  const [workSiteId, setWorkSiteId] = useState<number | "">(user.work_site_id ?? "")
  const [password, setPassword] = useState("")
  const [confirmSa, setConfirmSa] = useState("")
  const [saving, setSaving] = useState(false)
  const [loadingCat, setLoadingCat] = useState(true)

  useEffect(() => {
    let ok = true
    ;(async () => {
      try {
        const [a, s] = await Promise.all([
          api.get<CatalogRow[]>("/catalog/areas"),
          api.get<CatalogRow[]>("/catalog/sites"),
        ])
        if (ok) {
          setAreas(a.data)
          setSites(s.data)
        }
      } catch {
        toast.error("No se pudieron cargar áreas y sedes.")
      } finally {
        if (ok) setLoadingCat(false)
      }
    })()
    return () => {
      ok = false
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const pwd = password.trim()
    if (pwd && pwd.length < 5) {
      toast.error("La contraseña debe tener al menos 5 caracteres.")
      return
    }
    if (pwd && !confirmSa.trim()) {
      toast.error("Introduce tu contraseña de superadmin para confirmar el cambio de clave.")
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        email,
        full_name: fullName.trim() || null,
        work_area_id: workAreaId === "" ? null : workAreaId,
        work_site_id: workSiteId === "" ? null : workSiteId,
      }
      if (pwd) {
        body.password = pwd
        body.confirm_superadmin_password = confirmSa
      }
      await api.put(`/auth/users/${user.id}`, body)
      toast.success("Usuario actualizado")
      onSaved()
      onClose()
    } catch (e) {
      toast.error(detailMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg rounded-2xl border border-navy-600 bg-navy-900 shadow-xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <Pencil className="h-4 w-4 text-electric" />
          <h2 className="text-sm font-semibold text-white">Editar usuario</h2>
        </div>
        {loadingCat ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-electric" />
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            <label className="block text-xs text-slate-400">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Nombre completo
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm"
              />
            </label>
            <label className="block text-xs text-slate-400">
              Área
              <select
                value={workAreaId === "" ? "" : String(workAreaId)}
                onChange={(e) => setWorkAreaId(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm"
              >
                <option value="">— Sin área —</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-400">
              Sede (plataforma)
              <select
                value={workSiteId === "" ? "" : String(workSiteId)}
                onChange={(e) => setWorkSiteId(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm"
              >
                <option value="">— Sin sede —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="border-t border-navy-700 pt-3 mt-2">
              <p className="text-[11px] text-slate-500 mb-2">Nueva contraseña del usuario (opcional). Vacío = no cambia.</p>
              <label className="block text-xs text-slate-400">
                Nueva contraseña
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm"
                />
              </label>
              {password.trim().length > 0 && (
                <label className="block text-xs text-slate-400 mt-2">
                  Tu contraseña de superadmin (confirmación)
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={confirmSa}
                    onChange={(e) => setConfirmSa(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm"
                  />
                </label>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-navy-600 text-slate-400 text-sm hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-electric text-navy-950 text-sm font-semibold",
                  saving && "opacity-50"
                )}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Guardar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export function UserEditButton({ user, onSaved }: { user: User; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-lg text-slate-500 hover:text-electric hover:bg-electric/10 transition-all"
        title="Editar usuario"
      >
        <Pencil size={14} />
      </button>
      {open && <UserEditDialog user={user} onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  )
}
