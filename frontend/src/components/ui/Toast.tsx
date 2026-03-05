import { motion } from "framer-motion"
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Toast as ToastType } from "@/store/toastStore"

interface ToastProps {
  toast:    ToastType
  onClose:  (id: string) => void
}

const CONFIG = {
  success: { icon: CheckCircle,   classes: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" },
  error:   { icon: XCircle,       classes: "bg-red-500/15 border-red-500/30 text-red-300"             },
  warning: { icon: AlertTriangle, classes: "bg-amber-500/15 border-amber-500/30 text-amber-300"       },
  info:    { icon: Info,          classes: "bg-electric/15 border-electric/30 text-electric"          },
}

export default function Toast({ toast, onClose }: ToastProps) {
  const { icon: Icon, classes } = CONFIG[toast.type]

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0,  scale: 1   }}
      exit={{    opacity: 0, x: 60, scale: 0.9 }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg",
        "w-full max-w-sm pointer-events-auto",
        classes
      )}
    >
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}
