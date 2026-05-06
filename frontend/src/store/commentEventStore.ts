import { create } from "zustand"
import type { Comment } from "@/types/comment"

interface CommentEventState {
  lastCommentEvent: { projectId: number; comment: Comment } | null
  setLastCommentEvent: (projectId: number, comment: Comment) => void
}

export const useCommentEventStore = create<CommentEventState>((set) => ({
  lastCommentEvent: null,
  setLastCommentEvent: (projectId, comment) =>
    set({ lastCommentEvent: { projectId, comment } }),
}))
