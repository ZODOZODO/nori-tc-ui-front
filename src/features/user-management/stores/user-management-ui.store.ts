import { create } from 'zustand'
import type { UserManagementMode } from '../types/user-management.types'

interface UserManagementUiState {
  mode: UserManagementMode
  isProfileModalOpen: boolean
  setMode: (mode: UserManagementMode) => void
  setProfileModalOpen: (open: boolean) => void
}

export const useUserManagementUiStore = create<UserManagementUiState>((set) => ({
  mode: 'user',
  isProfileModalOpen: false,
  setMode: (mode) => set({ mode }),
  setProfileModalOpen: (open) => set({ isProfileModalOpen: open }),
}))
