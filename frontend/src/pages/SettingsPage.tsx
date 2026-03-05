import { useState } from "react"
import { Settings, Users, AlertCircle } from "lucide-react"
import { useSettings } from "@/hooks/useSettings"
import CategoryManager from "@/components/settings/CategoryManager"
import QuestionManager from "@/components/settings/QuestionManager"
import { motion } from "framer-motion"

export default function SettingsPage() {
  const {
    categories, questions, loading, error,
    createCategory, updateCategory, deleteCategory,
    createQuestion, updateQuestion, deleteQuestion,
  } = useSettings()

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm"
        >
          <AlertCircle size={15} />
          {error}
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-navy-700 pb-4">
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-electric/15 border border-electric/30 text-electric text-sm font-medium">
          <Settings size={15} /> Preguntas y Categorías
        </button>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 text-sm hover:text-white hover:bg-navy-800 transition-all border border-transparent">
          <Users size={15} /> Usuarios (próximamente)
        </button>
      </div>

      {/* Contenido */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="glass-card p-5">
          <CategoryManager
            categories={categories}
            selectedId={activeCatId}
            onSelect={setSelectedCatId}
            onCreate={createCategory}
            onUpdate={updateCategory}
            onDelete={deleteCategory}
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
                categoryId={activeCatId}
                questions={questions}
                onCreate={createQuestion}
                onUpdate={updateQuestion}
                onDelete={deleteQuestion}
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
    </div>
  )
}
