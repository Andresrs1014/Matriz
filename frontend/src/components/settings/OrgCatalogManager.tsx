import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import api from "@/lib/api"
import type { CatalogRow } from "@/types/catalog"
import { toast } from "@/store/toastStore"

function detailMessage(e: unknown): string {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof d === "string") return d
  return "Error al guardar."
}

export default function OrgCatalogManager() {
  const [areas, setAreas] = useState<CatalogRow[]>([])
  const [sites, setSites] = useState<CatalogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newArea, setNewArea] = useState("")
  const [newSite, setNewSite] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, s] = await Promise.all([
        api.get<CatalogRow[]>("/catalog/areas"),
        api.get<CatalogRow[]>("/catalog/sites"),
      ])
      setAreas(a.data)
      setSites(s.data)
    } catch {
      toast.error("No se pudieron cargar los catálogos.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addArea() {
    const n = newArea.trim()
    if (!n) return
    setBusy("area")
    try {
      await api.post("/catalog/areas", { name: n, sort_order: areas.length })
      setNewArea("")
      toast.success("Área creada")
      await load()
    } catch (e) {
      toast.error(detailMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function addSite() {
    const n = newSite.trim()
    if (!n) return
    setBusy("site")
    try {
      await api.post("/catalog/sites", { name: n, sort_order: sites.length })
      setNewSite("")
      toast.success("Sede creada")
      await load()
    } catch (e) {
      toast.error(detailMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function delArea(id: number) {
    if (!window.confirm("¿Eliminar esta área? solo si ningún usuario la usa.")) return
    setBusy(`da-${id}`)
    try {
      await api.delete(`/catalog/areas/${id}`)
      toast.success("Área eliminada")
      await load()
    } catch (e) {
      toast.error(detailMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function delSite(id: number) {
    if (!window.confirm("¿Eliminar esta sede? solo si ningún usuario la usa.")) return
    setBusy(`ds-${id}`)
    try {
      await api.delete(`/catalog/sites/${id}`)
      toast.success("Sede eliminada")
      await load()
    } catch (e) {
      toast.error(detailMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-electric" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-4 space-y-3">
        <p className="text-sm font-semibold text-white">Áreas</p>
        <p className="text-[11px] text-slate-500">Valores del desplegable &quot;Área&quot; en usuarios.</p>
        <div className="flex gap-2">
          <input
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            placeholder="Nombre del área"
            className="flex-1 px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm"
          />
          <button
            type="button"
            onClick={() => void addArea()}
            disabled={busy === "area"}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-electric/15 border border-electric/30 text-electric text-sm"
          >
            {busy === "area" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Añadir
          </button>
        </div>
        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {areas.length === 0 && <li className="text-xs text-slate-500">Sin áreas aún.</li>}
          {areas.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm text-slate-200 py-1 border-b border-navy-700/50">
              <span className="truncate">{r.name}</span>
              <button
                type="button"
                onClick={() => void delArea(r.id)}
                disabled={busy === `da-${r.id}`}
                className="p-1 text-slate-500 hover:text-red-400"
                title="Eliminar"
              >
                {busy === `da-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-navy-600 bg-navy-900/40 p-4 space-y-3">
        <p className="text-sm font-semibold text-white">Sedes (plataforma)</p>
        <p className="text-[11px] text-slate-500">Ej. Logimat, IMCargo — tú defines los nombres.</p>
        <div className="flex gap-2">
          <input
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            placeholder="Nombre de la sede"
            className="flex-1 px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm"
          />
          <button
            type="button"
            onClick={() => void addSite()}
            disabled={busy === "site"}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-electric/15 border border-electric/30 text-electric text-sm"
          >
            {busy === "site" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Añadir
          </button>
        </div>
        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {sites.length === 0 && <li className="text-xs text-slate-500">Sin sedes aún.</li>}
          {sites.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm text-slate-200 py-1 border-b border-navy-700/50">
              <span className="truncate">{r.name}</span>
              <button
                type="button"
                onClick={() => void delSite(r.id)}
                disabled={busy === `ds-${r.id}`}
                className="p-1 text-slate-500 hover:text-red-400"
                title="Eliminar"
              >
                {busy === `ds-${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
