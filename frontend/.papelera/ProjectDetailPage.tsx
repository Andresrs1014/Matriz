// // frontend/src/pages/ProjectDetailPage.tsx
// import { useCallback, useEffect, useState } from "react"
// import { useParams, useNavigate } from "react-router-dom"
// import { motion } from "framer-motion"
// import {
//   ArrowLeft, Calendar, ClipboardList, Target, Zap,
//   TrendingUp, MessageCircle, Lock, UserRound, Users,
// } from "lucide-react"
// import api from "@/lib/api"
// import { useAuthStore } from "@/store/authStore"
// import { isAdmin, isSuperAdmin, canVerROI, isUsuario } from "@/lib/roles"
// import { QUADRANT_CONFIG, type QuadrantKey } from "@/lib/constants"
// import { ROI_QUADRANT_CONFIG, type ROICuadranteKey } from "@/types/roi"
// import { cn } from "@/lib/utils"
// import type { Project } from "@/types/project"
// import type { ROIRead } from "@/types/roi"
// import EvaluationWizard from "@/components/evaluation/EvaluationWizard"
// import ProjectChat from "@/components/chat/ProjectChat"
// import MatrixMiniPlot from "@/components/matrix/MatrixMiniPlot"

// interface Evaluation {
//   id: number
//   impact_score: number
//   effort_score: number
//   quadrant: string
//   notes: string | null
//   created_at: string
// }

// const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
//   pendiente_revision:  { label: "Pendiente revisión",  class: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
//   escalado:            { label: "Escalado",            class: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
//   preguntas_asignadas: { label: "Preguntas asignadas", class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
//   en_evaluacion:       { label: "En evaluación",       class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
//   evaluado:            { label: "Evaluado",            class: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
//   pendiente_salario:   { label: "Pendiente salario",   class: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
//   calculando_roi:      { label: "Calculando ROI",      class: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
//   aprobado_final:      { label: "✓ Aprobado",          class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
//   rechazado:           { label: "Rechazado",           class: "bg-red-500/20 text-red-400 border-red-500/30" },
// }

// // Estados amigables para el usuario normal
// const STATUS_CONFIG_USUARIO: Record<string, { label: string; class: string }> = {
//   pendiente_revision:  { label: "En espera de revisión", class: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
//   escalado:            { label: "En revisión",           class: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
//   preguntas_asignadas: { label: "Aprobado, en cola",     class: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
//   en_evaluacion:       { label: "Siendo evaluado",       class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
//   evaluado:            { label: "Evaluado",              class: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
//   pendiente_salario:   { label: "Siendo evaluado",       class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
//   calculando_roi:      { label: "Siendo evaluado",       class: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
//   aprobado_final:      { label: "✓ Aprobado",            class: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
//   rechazado:           { label: "Rechazado",             class: "bg-red-500/20 text-red-400 border-red-500/30" },
// }

// export default function ProjectDetailPage() {
//   const { id } = useParams<{ id: string }>()
//   const navigate = useNavigate()
//   const { user } = useAuthStore()

//   const [project, setProject]       = useState<Project | null>(null)
//   const [evaluations, setEvaluations] = useState<Evaluation[]>([])
//   const [roiData, setRoiData]       = useState<ROIRead | null>(null)
//   const [loading, setLoading]       = useState(true)
//   const [fetchError, setFetchError] = useState<string | null>(null)
//   const [evaluating, setEvaluating] = useState(false)

//   const esUsuario   = isUsuario(user)
//   const canSeeROI   = canVerROI(user)
//   const canEvaluate = isAdmin(user) || isSuperAdmin(user)

//   const fetchData = useCallback(async () => {
//     if (!id) return
//     setLoading(true)
//     setFetchError(null)
//     try {
//       const [projRes, evalRes] = await Promise.all([
//         api.get(`/projects/${id}`),
//         api.get(`/matrix/history/${id}`).catch(() => ({ data: [] as Evaluation[] })),
//       ])
//       setProject(projRes.data)