import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Trash2, UserPlus } from "lucide-react"
import api from "@/lib/api"
import { toast } from "@/store/toastStore"
import type { User } from "@/types/auth"
import type { DevTeamMember } from "@/types/dev_team"
import { useAddDevTeamMember, useDevTeam, useRemoveDevTeamMember } from "@/hooks/useDevTeam"
import { cn } from "@/lib/utils"

export default function DevTeamManager() {
  const { data: members, loading, error, refetch } = useDevTeam()
  const { mutate: addMember, isPending: adding, error: addErr } = useAddDevTeamMember()
  const { mutate: removeMember } = useRemoveDevTeamMember()

  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selectedId, setSelectedId] = useState<string>("")
  const [removingId, setRemovingId] = useState<number | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const { data } = await api.get<User[]>("/auth/users")
      setUsers(data.filter((u) => u.is_active))
    } catch {
      toast.error("No se pudo cargar la lista de usuarios.")
      setUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const memberUserIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members])

  const candidates = useMemo(
    () => users.filter((u) => !memberUserIds.has(u.id)),
    [users, memberUserIds]
  )

  async function handleAdd() {
    const id = Number(selectedId)
    if (!id || Number.isNaN(id)) {
      toast.error("Selecciona un usuario.")
      return
    }
    const row = await addMember(id, () => {
      void refetch()
    })
    if (row) {
      toast.success(`${row.user_email} añadido al equipo`)
      setSelectedId("")
    } else if (addErr) toast.error(addErr)
  }

  async function handleRemove(m: DevTeamMember) {
    if (!window.confirm(`¿Quitar a ${m.user_email} del equipo de desarrollo?`)) return
    setRemovingId(m.user_id)
    const ok = await removeMember(m.user_id, () => {
      void refetch()
    })
    setRemovingId(null)
    if (ok) toast.success("Miembro eliminado del equipo")
    else toast.error("No se pudo eliminar al miembro.")
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-white">Miembros del equipo</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Reciben notificaciones cuando un proyecto se asigna al área de Desarrollo o hay actualizaciones OKR.
        </p>
      </div>

      {(error || addErr) && (
        <div className="text-xs text-red-400 border border-red-500/30 rounded-lg px-3 py-2">{error ?? addErr}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-electric" />
        </div>
      ) : (
        <ul className="space-y-2">
          {members.length === 0 && (
            <li className="text-sm text-slate-500 text-center py-6">Aún no hay miembros configurados.</li>
          )}
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-navy-800/60 border border-navy-700"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{m.user_full_name ?? m.user_email}</p>
                <p className="text-xs text-slate-500 truncate">{m.user_email}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleRemove(m)}
                disabled={removingId === m.user_id}
                className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                title="Quitar del equipo"
              >
                {removingId === m.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2 border-t border-navy-700 space-y-3">
        <p className="text-xs font-medium text-slate-400">Añadir desde usuarios del sistema</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loadingUsers || adding}
            className={cn(
              "flex-1 min-h-10 px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm",
              "focus:outline-none focus:border-electric"
            )}
          >
            <option value="">
              {loadingUsers ? "Cargando usuarios…" : candidates.length === 0 ? "No hay usuarios disponibles" : "Selecciona usuario"}
            </option>
            {candidates.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.full_name ?? u.email} — {u.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={adding || !selectedId || candidates.length === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-electric/15 border border-electric/35 text-electric text-sm font-medium hover:bg-electric/25 disabled:opacity-40 transition-all"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Añadir
          </button>
        </div>
      </div>
    </div>
  )
}
