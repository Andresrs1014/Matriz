import React, { Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import { canAccessSettings, type Role } from "@/lib/roles"
import AppLayout from "@/components/layout/AppLayout"
import UserDashboardPage from "@/pages/UserDashboardPage"

const LoginPage         = React.lazy(() => import("@/pages/LoginPage"))
const DashboardPage     = React.lazy(() => import("@/pages/DashboardPage"))
const ProjectsPage      = React.lazy(() => import("@/pages/ProjectsPage"))
const ProjectDetailPage = React.lazy(() => import("@/pages/ProjectDetailPage"))
const MatrixPage        = React.lazy(() => import("@/pages/MatrixPage"))
const SettingsPage      = React.lazy(() => import("@/pages/SettingsPage"))

function Spinner() {
  return (
    <div className="flex items-center justify-center h-screen bg-navy-950">
      <div className="w-8 h-8 border-2 border-electric rounded-full animate-spin border-t-transparent" />
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
  if (!canAccessSettings(user)) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireRole({ children, roles }: { children: React.ReactNode; roles: Role[] }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role as Role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login"    element={<LoginPage />} />

        {/* Rutas protegidas — todas bajo AppLayout */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index                path="/"              element={<DashboardPage />} />
          <Route                      path="/projects"      element={<ProjectsPage />} />
          <Route                      path="/projects/:id"  element={<ProjectDetailPage />} />
          <Route                      path="/matrix"        element={<MatrixPage />} />
          <Route
            path="/settings"
            element={
              <AdminRoute>
                <SettingsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/my-dashboard"
            element={
              <RequireRole roles={["usuario"]}>
                <UserDashboardPage />
              </RequireRole>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
