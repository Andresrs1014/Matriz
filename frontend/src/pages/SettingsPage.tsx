import { useState, useEffect } from "react"
import { Settings, Users, AlertCircle, Plus, Trash2, Shield, RotateCcw, UserX } from "lucide-react"
import { useSettings } from "@/hooks/useSettings"
import CategoryManager from "@/components/settings/CategoryManager"
import QuestionManager from "@/components/settings/QuestionManager"
import { motion, AnimatePresence } from "framer-motion"
import { useAuthStore } from "@/store/authStore"
import { isSuperAdmin, isAdmin, ROLE_LABELS, ROLE_COLORS } from "@/lib/roles"
import type { Role } from "@/lib/roles"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import type { User } from "@/types/auth"

type TabKey       = "config" | "usuarios"
type UserTabView  = "activos" | "archivados"

export default function SettingsPage() {
  const {
    categories, questions, loading, error,
    createCategory, updateCategory, deleteCategory,
    createQuestion, updateQuestion, deleteQuestion,
  } = useSettings()

  const { user: me } = useAuthStore()
  const [tab, setTab] = useState<TabKey>("config")
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const activeCatId = selectedCatId ?? categories.find((c) => c.is_default)?.id ?? null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-electric rounded-full animate-spin border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          <AlertCircle size={15} />{error}
        </motion.div>
      )}

      {/* Tabs principales */}
      <div className="flex items-center gap-3 border-b border-navy-700 pb-4">
        <button onClick={() => setTab("config")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border",
            tab === "config"
              ? "bg-electric/15 border-electric/30 text-electric"
              : "text-slate-400 hover:text-white hover:bg-navy-800 border-transparent"
          )}>
          <Settings size={15} /> Preguntas y Categorías
        </button>
        <button onClick={() => setTab("usuarios")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border",
            tab === "usuarios"
              ? "bg-electric/15 border-electric/30 text-electric"
              : "text-slate-400 hover:text-white hover:bg-navy-800 border-transparent"
          )}>
          <Users size={15} /> Usuarios
        </button>
      </div>

      {/* Tab Configuración */}
      {tab === "config" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-5">
              <CategoryManager
                categories={categories} selectedId={activeCatId}
                onSelect={setSelectedCatId} onCreate={createCategory}
                onUpdate={updateCategory} onDelete={deleteCategory}
              />
            </div>
            <div className="glass-card p-5">
              {activeCatId ? (
                <>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-2 h-2 rounded-full bg-electric animate-pulse" />
                    <p className="text-sm font-semibold text-white">
                      {categories.find((c) => c.id === activeCatId)?.name ?? "Categoría"}
                    </p>
                  </div>
                  <QuestionManager
                    categoryId={activeCatId} questions={questions}
                    onCreate={createQuestion} onUpdate={updateQuestion} onDelete={deleteQuestion}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Settings size={36} className="text-navy-700 mb-3" />
                  <p className="text-slate-400 text-sm">Selecciona una categoría</p>
                  <p className="text-slate-600 text-xs mt-1">para ver y gestionar sus preguntas</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
            <AlertCircle size={15} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300/80">
              Los cambios en preguntas y pesos afectan las <strong>nuevas evaluaciones</strong>.
              Las evaluaciones ya realizadas no se recalculan automáticamente.
            </p>
          </div>
        </>
      )}

      {/* Tab Usuarios */}
      {tab === "usuarios" && (
        <UsersTab currentUser={me} />
      )}
    </div>
  )
}

// ── Panel de gestión de usuarios ─────────────────────────────────────────────
function UsersTab({ currentUser }: { currentUser: User | null }) {
  const [view,       setView]       = useState<UserTabView>("activos")
  const [users,      setUsers]      = useState<User[]>([])
  const [archived,   setArchived]   = useState<User[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form,       setForm]       = useState({ email: "", full_name: "", password: "", role: "usuario", area: "" })
  const [creating,   setCreating]   = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [confirm,    setConfirm]    = useState<number | null>(null)  // id del user a eliminar permanente

  const isSA    = isSuperAdmin(currentUser)
  const isAdm   = isAdmin(currentUser)
  const ROLES: Role[] = ["usuario", "coordinador", "admin", "superadmin"]

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [activeRes, archiveRes] = await Promise.all([
        api.get<User[]>("/auth/users"),
        api.get<User[]>("/auth/users/archived"),
      ])
      setUsers(activeRes.data)
      setArchived(archiveRes.data)
    } catch {
      setError("No se pudo cargar la lista de usuarios.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      await api.post("/auth/register", {
        email: form.email, full_name: form.full_name,
        password: form.password, area: form.area || undefined,
      })
      if (form.role !== "usuario") {
        const res    = await api.get<User[]>("/auth/users")
        const created = res.data.find(u => u.email === form.email)
        if (created) await api.put(`/auth/users/${created.id}/role`, { role: form.role })
      }
      setShowCreate(false)
      setForm({ email: "", full_name: "", password: "", role: "usuario", area: "" })
      fetchAll()
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al crear usuario.")
    } finally {
      setCreating(false)
    }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    try {
      await api.put(`/auth/users/${userId}/role`, { role: newRole })
      fetchAll()
    } catch { setError("No se pudo cambiar el rol.") }
  }

  async function handleDeactivate(userId: number) {
    try {
      await api.delete(`/auth/users/${userId}`)
      fetchAll()
    } catch { setError("No se pudo desactivar el usuario.") }
  }

  async function handleReactivate(userId: number) {
    try {
      await api.post(`/auth/users/${userId}/reactivar`)
      fetchAll()
    } catch { setError("No se pudo reactivar el usuario.") }
  }

  async function handlePermanentDelete(userId: number) {
    try {
      await api.delete(`/auth/users/${userId}/permanent`)
      setConfirm(null)
      fetchAll()
    } catch { setError("No se pudo eliminar el usuario.") }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">
          <AlertCircle size={14} />{error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-white">×</button>
        </div>
      )}

      {/* Subtabs activos / archivados */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-navy-900 border border-navy-700 rounded-xl p-1">
          <button onClick={() => setView("activos")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              view === "activos" ? "bg-electric text-white" : "text-slate-400 hover:text-white")}>
            Activos ({users.length})
          </button>
          <button onClick={() => setView("archivados")}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              view === "archivados" ? "bg-amber-500 text-white" : "text-slate-400 hover:text-white")}>
            Archivados ({archived.length})
          </button>
        </div>
        {view === "activos" && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-electric/10 border border-electric/30 text-electric text-sm font-medium hover:bg-electric/20 transition-all">
            <Plus size={14} /> Nuevo usuario
          </button>
        )}
      </div>

      {/* Formulario crear */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="glass-card p-5 border border-electric/20">
            <p className="text-sm font-semibold text-white mb-4">Crear nuevo usuario</p>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="Nombre completo" value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric" />
              <input placeholder="Email" type="email" required value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric" />
              <input placeholder="Contraseña" type="password" required value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric" />
              <input placeholder="Área (opcional)" value={form.area}
                onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric" />
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm focus:outline-none focus:border-electric">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <div className="flex gap-2 sm:col-span-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg border border-navy-600 text-slate-400 text-sm hover:text-white transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={creating}
                  className="px-4 py-2 rounded-lg bg-electric text-white text-sm font-medium hover:bg-electric-bright disabled:opacity-40 transition-all">
                  {creating ? "Creando..." : "Crear usuario"}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-electric rounded-full animate-spin border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Lista activos */}
          {view === "activos" && (
            <div className="space-y-2">
              {users.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-8">No hay usuarios activos.</p>
              )}
              {users.map(u => {
                const role      = (u.role ?? "usuario") as Role
                const isMe      = u.id === currentUser?.id
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-navy-800/60 border border-navy-700">
                    <div className="w-8 h-8 rounded-lg bg-navy-700 border border-navy-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {(u.full_name ?? u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{u.full_name ?? "Sin nombre"}</p>
                      <p className="text-slate-500 text-xs truncate">{u.email}</p>
                    </div>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", ROLE_COLORS[role])}>
                      {ROLE_LABELS[role]}
                    </span>
                    {!isMe && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isSA && (
                          <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                            className="px-2 py-1 rounded bg-navy-700 border border-navy-600 text-white text-xs focus:outline-none focus:border-electric">
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                        )}
                        {(isSA || isAdm) && (
                          <button onClick={() => handleDeactivate(u.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                            title="Archivar usuario">
                            <UserX size={14} />
                          </button>
                        )}
                        {!isSA && !isAdm && (
                          <span title="Sin permisos para modificar">
                            <Shield size={13} className="text-slate-600" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Lista archivados */}
          {view === "archivados" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 px-1">
                Usuarios archivados en los últimos 6 meses. Después de ese periodo se ocultan automáticamente.
              </p>
              {archived.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-8">No hay usuarios archivados.</p>
              )}
              {archived.map(u => {
                const role = (u.role ?? "usuario") as Role
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-navy-800/40 border border-amber-500/20 opacity-80">
                    <div className="w-8 h-8 rounded-lg bg-navy-700 border border-navy-600 flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0">
                      {(u.full_name ?? u.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 text-sm font-medium truncate">{u.full_name ?? "Sin nombre"}</p>
                      <p className="text-slate-600 text-xs truncate">{u.email}</p>
                    </div>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 opacity-60", ROLE_COLORS[role])}>
                      {ROLE_LABELS[role]}
                    </span>
                    {(isSA || isAdm) && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Reactivar */}
                        <button onClick={() => handleReactivate(u.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
                          title="Reactivar usuario">
                          <RotateCcw size={12} /> Reactivar
                        </button>
                        {/* Eliminar permanente — pide confirmación */}
                        {confirm === u.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-400">¿Confirmar?</span>
                            <button onClick={() => handlePermanentDelete(u.id)}
                              className="px-2 py-1 rounded text-xs bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all">
                              Sí, eliminar
                            </button>
                            <button onClick={() => setConfirm(null)}
                              className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white transition-all">
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirm(u.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Eliminar permanentemente">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
