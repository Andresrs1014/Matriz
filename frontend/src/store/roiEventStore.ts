import { create } from "zustand"

interface ROIEventStore {
  roiRefreshCount: number
  triggerROIRefresh: () => void
}

export const useROIEventStore = create<ROIEventStore>((set) => ({
  roiRefreshCount: 0,
  triggerROIRefresh: () => set((s) => ({ roiRefreshCount: s.roiRefreshCount + 1 })),
}))
