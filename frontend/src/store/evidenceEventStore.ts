import { create } from "zustand"
import type { Evidence } from "@/types/evidence"

interface EvidenceEventState {
  lastEvent: { projectId: number; type: "added" | "removed"; evidence?: Evidence } | null
  setLastEvent: (projectId: number, type: "added" | "removed", evidence?: Evidence) => void
}

export const useEvidenceEventStore = create<EvidenceEventState>((set) => ({
  lastEvent: null,
  setLastEvent: (projectId, type, evidence) =>
    set({ lastEvent: { projectId, type, evidence } }),
}))
