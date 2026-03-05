import { create } from "zustand"

export type ToastType = "success" | "error" | "warning" | "info"

export interface Toast {
  id:      string
  type:    ToastType
  message: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast:    (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type = "info", duration = 4000) => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, type, message, duration }] }))
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Helper global para usar fuera de componentes
export const toast = {
  success: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, "success", duration),
  error: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, "error", duration),
  warning: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, "warning", duration),
  info: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, "info", duration),
}
