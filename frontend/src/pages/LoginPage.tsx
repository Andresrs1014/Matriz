import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Zap, Eye, EyeOff, LogIn } from "lucide-react"
import api from "@/lib/api"
import { useAuthStore } from "@/store/authStore"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const navigate   = useNavigate()
  const { setAuth } = useAuthStore()


  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const form = new URLSearchParams()
      form.append("username", email)
      form.append("password", password)

      const { data: tokenData } = await api.post("/auth/token", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
      const { data: userData } = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      setAuth(userData, tokenData.access_token)
      navigate("/")
    } catch {
      setError("Credenciales incorrectas. Verifica tu email y contraseña.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4 relative overflow-hidden">

      <div className="absolute inset-0 pointer-events-none">
        <div className="laser-line-h absolute top-1/3 left-0 right-0 opacity-20" />
        <div className="laser-line-h absolute top-2/3 left-0 right-0 opacity-10" />
        <div className="laser-line-v absolute left-1/4 top-0 bottom-0 opacity-10" />
        <div className="laser-line-v absolute right-1/4 top-0 bottom-0 opacity-10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-electric/20 border border-electric/40 flex items-center justify-center shadow-glow-blue mb-4">
              <Zap size={28} className="text-electric" />
            </div>
            <h1 className="text-2xl font-bold text-white glow-text">Project Matrix</h1>
            <p className="text-sm text-slate-400 mt-1">Inicia sesión para continuar</p>
          </div>

          <div className="laser-line-h mb-8 opacity-50" />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="andres@empresa.com"
                required
                className="w-full px-4 py-3 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-lg bg-navy-800 border border-navy-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-electric transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-medium text-sm bg-electric text-white hover:bg-electric-bright shadow-glow-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><LogIn size={16} /><span>Ingresar</span></>
              }
            </button>
          </form>

        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Project Matrix Beta — Gestión inteligente de proyectos
        </p>
      </motion.div>
    </div>
  )
}
