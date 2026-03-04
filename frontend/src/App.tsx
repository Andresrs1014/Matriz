import React, { Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"
import AppLayout from "@/components/layout/AppLayout"

const LoginPage     = React.lazy(() => import("@/pages/LoginPage.tsx"))
const DashboardPage = React.lazy(() => import("@/pages/DashboardPage.tsx"))
const ProjectsPage  = React.lazy(() => import("@/pages/ProjectsPage.tsx"))
const MatrixPage    = React.lazy(() => import("@/pages/MatrixPage.tsx"))

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

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Ruta pública */}
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas protegidas — todas comparten AppLayout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout title="Dashboard" />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <AppLayout title="Proyectos" subtitle="Gestión de tus proyectos" />
            </ProtectedRoute>
          }
        >
          <Route path="/projects" element={<ProjectsPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <AppLayout title="Matriz de Esfuerzo" subtitle="Posicionamiento estratégico de proyectos" />
            </ProtectedRoute>
          }
        >
          <Route path="/matrix" element={<MatrixPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
