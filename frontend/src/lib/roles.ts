// frontend/src/lib/roles.ts
import type { User } from "@/types/auth"

export type Role = "superadmin" | "admin" | "coordinador" | "usuario"

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Admin",
  admin:      "Administrador",
  coordinador: "Coordinador",
  usuario:    "Usuario",
}

export const ROLE_COLORS: Record<Role, string> = {
  superadmin:  "text-amber-400 bg-amber-500/10 border-amber-500/30",
  admin:       "text-electric bg-electric/10 border-electric/30",
  coordinador: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  usuario:     "text-slate-400 bg-slate-500/10 border-slate-500/20",
}

export function isSuperAdmin(user: User | null): boolean {
  return user?.role === "superadmin"
}

export function isAdmin(user: User | null): boolean {
  // admin incluye superadmin para acciones de admin
  return user?.role === "admin" || user?.role === "superadmin"
}

export function isCoordinador(user: User | null): boolean {
  return user?.role === "coordinador"
}

export function isUsuario(user: User | null): boolean {
  return user?.role === "usuario"
}

export function canAccessSettings(user: User | null): boolean {
  return isAdmin(user) || isCoordinador(user)
}

// ── Helpers específicos del flujo ────────────────────────────────────────────

/** Admin puede escalar un proyecto pendiente_revision */
export function canEscalar(user: User | null, status: string): boolean {
  return user?.role === "admin" && status === "pendiente_revision"
}

/** Superadmin puede aprobar + asignar preguntas */
export function canSuperaprobar(user: User | null, status: string): boolean {
  return isSuperAdmin(user) && status === "escalado"
}

/** Admin puede iniciar evaluación */
export function canIniciarEvaluacion(user: User | null, status: string): boolean {
  return user?.role === "admin" && status === "preguntas_asignadas"
}

/** Admin puede marcar evaluado (después de llenar matrix) */
export function canMarcarEvaluado(user: User | null, status: string): boolean {
  return user?.role === "admin" && status === "en_evaluacion"
}

/** Superadmin puede proveer salario */
export function canProveerSalario(user: User | null, status: string): boolean {
  return isSuperAdmin(user) && status === "evaluado"
}

/** Admin puede completar ROI (horas/personas) */
export function canCompletarROI(user: User | null, status: string): boolean {
  return user?.role === "admin" && status === "pendiente_salario"
}

/** Coordinador y admin+ pueden ver ROI calculado */
export function canVerROI(user: User | null): boolean {
  return user?.role === "coordinador" || isAdmin(user)
}

/** Admin o superadmin pueden rechazar en cualquier etapa */
export function canRechazar(user: User | null, status: string): boolean {
  return isAdmin(user) && !["aprobado_final", "rechazado"].includes(status)
}
