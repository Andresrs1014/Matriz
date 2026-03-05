import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Pencil, Trash2, Star, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Category, CategoryCreate } from "@/types/settings"

interface Props {
  categories:     Category[]
  selectedId:     number | null
  onSelect:       (id: number) => void
  onCreate:       (p: CategoryCreate) => Promise<Category | null>
  onUpdate:       (id: number, p: Partial<CategoryCreate & { is_active: boolean }>) => Promise<void>
  onDelete:       (id: number) => Promise<void>
}

export default function CategoryManager({ categories, selectedId, onSelect, onCreate, onUpdate, onDelete }: Props) {
  const [showForm,  setShowForm]  = useState(false)
  const [editId,    setEditId]    = useState<number | null>(null)
  const [name,      setName]      = useState("")
  const [desc,      setDesc]      = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [saving,    setSaving]    = useState(false)

  function openCreate() {
    setEditId(null); setName(""); setDesc(""); setIsDefault(false); setShowForm(true)
  }

  function openEdit(cat: Category) {
    setEditId(cat.id); setName(cat.name); setDesc(cat.description ?? "")
    setIsDefault(cat.is_default); setShowForm(true)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    if (editId) {
      await onUpdate(editId, { name: name.trim(), description: desc.trim() || undefined, is_default: isDefault })
    } else {
      await onCreate({ name: name.trim(), description: desc.trim() || undefined, is_default: isDefault })
    }
    setSaving(false)
    setShowForm(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Categorías de evaluación</h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-electric/10 border border-electric/30 text-electric text-xs hover:bg-electric/20 transition-all"
        >
          <Plus size={13} /> Nueva categoría
        </button>
      </div>

      {/* Formulario */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 space-y-3"
          >
            <p className="text-xs font-semibold text-slate-300">
              {editId ? "Editar categoría" : "Nueva categoría"}
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Compras y Proveedores"
              className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all"
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all"
            />
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="accent-blue-500"
              />
              Establecer como categoría por defecto
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white border border-navy-600 transition-all">
                <X size={12} /> Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !name.trim()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-electric text-white hover:bg-electric-bright disabled:opacity-40 transition-all">
                {saving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={12} />}
                Guardar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de categorías */}
      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all",
              selectedId === cat.id
                ? "bg-electric/15 border-electric/40 shadow-glow-blue"
                : "bg-navy-800/50 border-navy-700 hover:border-navy-600"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {cat.is_default && <Star size={13} className="text-amber-400 flex-shrink-0" />}
              <div className="min-w-0">
                <p className={cn("text-sm font-medium truncate", selectedId === cat.id ? "text-electric" : "text-white")}>
                  {cat.name}
                </p>
                <p className="text-xs text-slate-500">{cat.question_count} pregunta{cat.question_count !== 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <button onClick={(e) => { e.stopPropagation(); openEdit(cat) }} className="p-1.5 rounded-lg text-slate-500 hover:text-electric hover:bg-electric/10 transition-all">
                <Pencil size={13} />
              </button>
              {!cat.is_default && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(cat.id) }} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
