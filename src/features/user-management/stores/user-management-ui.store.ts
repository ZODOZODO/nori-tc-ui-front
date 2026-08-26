import { create } from 'zustand'
import type { UserManagementMode } from '../types/user-management.types'

interface UserManagementUiState {
  mode: UserManagementMode
  setMode: (mode: UserManagementMode) => void
}

/**
 * `/user` 페이지의 User / Group 모드입니다.
 *
 * <p>라우트가 아니라 store 가 소유한다 — 두 모드는 같은 화면의 관리 대상 전환이라 각자 URL 을
 * 가지면 LNB 항목이 둘로 갈라진다. 페이지를 떠났다 돌아와도 마지막 대상이 유지된다.</p>
 */
export const useUserManagementUiStore = create<UserManagementUiState>((set) => ({
  mode: 'user',
  setMode: (mode) => set({ mode }),
}))
