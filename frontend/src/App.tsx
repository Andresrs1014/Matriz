// frontend/src/App.tsx
import React, { Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { canAccessSettings, isUsuario, type Role } from "@/lib/roles"
import AppLayout from "@/components/layout/AppLayout"

const LoginPage          = React.lazy(() => import("@/pages/LoginPage"))
const DashboardPage      = React.lazy(() => import("@/pages/DashboardPage"))
const ProjectsPage       = React.lazy(() => import("@/pages/ProjectsPage"))
const UserProjectsPage   = React.lazy(() => import("@/pages/UserProjectsPage"))
const ProjectDetailPage  = React.lazy(() => import("@/pages/ProjectDetailShowcasePage"))
const MatrixPage         = React.lazy(() => import("@/pages/MatrixPage"))
const SettingsPage       = React.lazy(() => import("@/pages/SettingsPage"))

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full w-full py-20">
      <div className="w-6 h-6 border-2 border-electric/30 border-t-electric rounded-full animate-spin" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!canAccessSettings(user)) return <Navigate to="/projects" replace />
  return <>{children}</>
}

function RequireRole({ children, roles }: { children: React.ReactNode; roles: Role[] }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role as Role)) return <Navigate to="/projects" replace />
  return <>{children}</>
}

export default function App() {
  const user = useAuthStore((s) => s.user)
  const userIsUsuario = isUsuario(user)

  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protegidas — bajo AppLayout */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Proyectos: usuario va a /mis-proyectos, resto a /projects */}
          <Route path="/projects" element={
            userIsUsuario
              ? <Navigate to="/mis-proyectos" replace />
              : <ProjectsPage />
          } />

          {/* Vista exclusiva para usuario normal */}
          <Route path="/mis-proyectos" element={
            <RequireRole roles={["usuario"]}>
              <UserProjectsPage />
            </RequireRole>
          } />

          {/* Detalle — todos pueden ver (ProjectDetailPage controla qué muestra por rol) */}
          <Route path="/projects/:id" element={<ProjectDetailPage />} />

          {/* Matriz — oculta para usuario */}
          {!userIsUsuario && (
            <Route path="/matrix" element={<MatrixPage />} />
          )}

          {/* Configuración — solo admin+ */}
          <Route path="/settings" element={
            <AdminRoute><SettingsPage /></AdminRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
