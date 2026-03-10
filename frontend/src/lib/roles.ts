import type { User } from "@/types/auth"

export type Role = "superadmin" | "admin" | "coordinador" | "usuario"

export const ROLE_LABELS: Record<Role, string> = {
  superadmin:  "Super Admin",
  admin:       "Administrador",
  coordinador: "Coordinador",
  usuario:     "Usuario",
}

export const ROLE_COLORS: Record<Role, string> = {
  superadmin:  "text-amber-400 bg-amber-500/10 border-amber-500/30",
  admin:       "text-electric bg-electric/10 border-electric/30",
  coordinador: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  usuario:     "text-slate-400 bg-slate-500/10 border-slate-500/20",
}

export function isAdmin(user: User | null): boolean {
  return user?.role === "admin" || user?.role === "superadmin"
}

export function isSuperAdmin(user: User | null): boolean {
  return user?.role === "superadmin"
}

export function isCoordinador(user: User | null): boolean {
  return user?.role === "coordinador"
}

export function canAccessSettings(user: User | null): boolean {
  return isAdmin(user) || isCoordinador(user)
}

export function canApprove(user: User | null): boolean {
  return isAdmin(user)
}

export function canEvaluate(user: User | null): boolean {
  return isCoordinador(user) || isAdmin(user)
}
