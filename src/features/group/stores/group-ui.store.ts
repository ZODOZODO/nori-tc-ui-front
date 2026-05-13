import { create } from 'zustand'

export type GroupUpsertMode = 'create' | 'edit'

interface GroupUiState {
  listOffset: number
  activeGroupId: number | null
  isUpsertModalOpen: boolean
  upsertMode: GroupUpsertMode
  isDeleteDialogOpen: boolean
  pendingDeleteGroupId: number | null
  setListOffset: (offset: number) => void
  resetListOffset: () => void
  selectGroup: (groupId: number | null) => void
  openCreateModal: () => void
  openEditModal: (groupId: number) => void
  closeUpsertModal: () => void
  openDeleteDialog: (groupId: number) => void
  closeDeleteDialog: () => void
}

export const useGroupUiStore = create<GroupUiState>((set) => ({
  listOffset: 0,
  activeGroupId: null,
  isUpsertModalOpen: false,
  upsertMode: 'create',
  isDeleteDialogOpen: false,
  pendingDeleteGroupId: null,
  setListOffset: (offset) => set({ listOffset: Math.max(0, offset) }),
  resetListOffset: () => set({ listOffset: 0 }),
  selectGroup: (groupId) => set({ activeGroupId: groupId }),
  openCreateModal: () =>
    set({ isUpsertModalOpen: true, upsertMode: 'create', activeGroupId: null }),
  openEditModal: (groupId) =>
    set({ isUpsertModalOpen: true, upsertMode: 'edit', activeGroupId: groupId }),
  closeUpsertModal: () => set({ isUpsertModalOpen: false }),
  openDeleteDialog: (groupId) =>
    set({ isDeleteDialogOpen: true, pendingDeleteGroupId: groupId }),
  closeDeleteDialog: () =>
    set({ isDeleteDialogOpen: false, pendingDeleteGroupId: null }),
}))
