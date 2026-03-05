import { AnimatePresence } from "framer-motion"
import { useToastStore } from "@/store/toastStore"
import Toast from "./Toast"

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-6 right-4 z-[100] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence mode="sync">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  )
}
