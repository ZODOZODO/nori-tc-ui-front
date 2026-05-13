import { create } from 'zustand'
import type { DlqMode } from '../types/dlq.types'

interface DlqUiState {
  mode: DlqMode
  isProfileModalOpen: boolean
  setMode: (mode: DlqMode) => void
  setProfileModalOpen: (open: boolean) => void
}

export const useDlqUiStore = create<DlqUiState>((set) => ({
  mode: 'gateway',
  isProfileModalOpen: false,
  setMode: (mode) => set({ mode }),
  setProfileModalOpen: (open) => set({ isProfileModalOpen: open }),
}))
