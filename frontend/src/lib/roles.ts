import type { User } from "@/types/auth"

export type Role = "superadmin" | "admin" | "user"

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Admin",
  admin:      "Administrador",
  user:       "Usuario",
}

export const ROLE_COLORS: Record<Role, string> = {
  superadmin: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  admin:      "text-electric bg-electric/10 border-electric/30",
  user:       "text-slate-400 bg-slate-500/10 border-slate-500/20",
}

export function isAdmin(user: User | null): boolean {
  return user?.role === "admin" || user?.role === "superadmin"
}

export function isSuperAdmin(user: User | null): boolean {
  return user?.role === "superadmin"
}

export function canAccessSettings(user: User | null): boolean {
  return isAdmin(user)
}
