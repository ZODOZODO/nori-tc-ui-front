import { create } from 'zustand'

export type UserUpsertMode = 'create' | 'edit'

interface UserUiState {
  listOffset: number
  activeUserPk: number | null
  isUpsertModalOpen: boolean
  upsertMode: UserUpsertMode
  isDeleteDialogOpen: boolean
  pendingDeleteUserPk: number | null
  isPasswordResetModalOpen: boolean
  passwordResetUserPk: number | null
  isProfileModalOpen: boolean
  setListOffset: (offset: number) => void
  resetListOffset: () => void
  selectUser: (userPk: number | null) => void
  openCreateModal: () => void
  openEditModal: (userPk: number) => void
  closeUpsertModal: () => void
  openDeleteDialog: (userPk: number) => void
  closeDeleteDialog: () => void
  openPasswordResetModal: (userPk: number) => void
  closePasswordResetModal: () => void
  setProfileModalOpen: (open: boolean) => void
}

export const useUserUiStore = create<UserUiState>((set) => ({
  listOffset: 0,
  activeUserPk: null,
  isUpsertModalOpen: false,
  upsertMode: 'create',
  isDeleteDialogOpen: false,
  pendingDeleteUserPk: null,
  isPasswordResetModalOpen: false,
  passwordResetUserPk: null,
  isProfileModalOpen: false,
  setListOffset: (offset) => set({ listOffset: Math.max(0, offset) }),
  resetListOffset: () => set({ listOffset: 0 }),
  selectUser: (userPk) => set({ activeUserPk: userPk }),
  openCreateModal: () =>
    set({ isUpsertModalOpen: true, upsertMode: 'create', activeUserPk: null }),
  openEditModal: (userPk) =>
    set({ isUpsertModalOpen: true, upsertMode: 'edit', activeUserPk: userPk }),
  closeUpsertModal: () => set({ isUpsertModalOpen: false }),
  openDeleteDialog: (userPk) =>
    set({ isDeleteDialogOpen: true, pendingDeleteUserPk: userPk }),
  closeDeleteDialog: () =>
    set({ isDeleteDialogOpen: false, pendingDeleteUserPk: null }),
  openPasswordResetModal: (userPk) =>
    set({ isPasswordResetModalOpen: true, passwordResetUserPk: userPk }),
  closePasswordResetModal: () =>
    set({ isPasswordResetModalOpen: false, passwordResetUserPk: null }),
  setProfileModalOpen: (open) => set({ isProfileModalOpen: open }),
}))
