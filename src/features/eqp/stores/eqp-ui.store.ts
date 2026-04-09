import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  clampSidebarWidth,
  SIDEBAR_COLLAPSED_WIDTH_PX,
  SIDEBAR_DEFAULT_WIDTH_PX,
} from '@/shared/layout/sidebar-layout'
import type { EqpSelection } from '../types/eqp.types'

interface EqpUiState {
  selection: EqpSelection
  sidebarOpen: boolean
  sidebarWidth: number
  expandedSidebarWidth: number
  isEditMode: boolean
  isProfileModalOpen: boolean
  /** 상하 패널 분리 핸들의 상단 패널 높이 비율(%) */
  topPanelHeightPercent: number
  selectEqp: (eqpId: string) => void
  selectGatewayAll: () => void
  selectBusinessAll: () => void
  selectGatewayGroup: (groupIndex: number) => void
  selectBusinessGroup: (groupIndex: number) => void
  clearSelection: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  expandSidebar: () => void
  collapseSidebar: () => void
  toggleSidebar: () => void
  setEditMode: (enabled: boolean) => void
  setProfileModalOpen: (open: boolean) => void
  /**
   * 상하 패널 높이 비율을 갱신합니다.
   * 직접 값 또는 이전 값을 받는 updater 함수 모두 허용합니다.
   */
  setTopPanelHeightPercent: (updater: number | ((prev: number) => number)) => void
}

interface EqpUiPersistedState {
  selection: EqpSelection
}

/** 상하 패널 초기 높이 비율(%) */
export const EQP_PANEL_INITIAL_TOP_PERCENT = 35

const EQP_UI_SELECTION_STORAGE_KEY = 'eqp-ui-selection'

/**
 * EQP 화면 전역 UI 상태 저장소입니다.
 * - 사이드바 확장/축소
 * - 선택 상태 (없음/gateway 전체/gateway_group/business_group/개별 설비)
 * - 편집 모드
 * - 프로필 모달 오픈 상태를 한 곳에서 관리합니다.
 */
export const useEqpUiStore = create<EqpUiState>()(
  persist(
    (set) => ({
      selection: { type: 'none' },
      sidebarOpen: true,
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH_PX,
      expandedSidebarWidth: SIDEBAR_DEFAULT_WIDTH_PX,
      isEditMode: false,
      isProfileModalOpen: false,
      topPanelHeightPercent: EQP_PANEL_INITIAL_TOP_PERCENT,
      // 개별 설비 선택
      selectEqp: (eqpId) => set({ selection: { type: 'eqp', eqpId } }),
      // Gateway 전체 선택
      selectGatewayAll: () => set({ selection: { type: 'gateway_all' } }),
      // Business 전체 선택
      selectBusinessAll: () => set({ selection: { type: 'business_all' } }),
      // gateway_app 그룹 선택
      selectGatewayGroup: (groupIndex) => set({ selection: { type: 'gateway_group', groupIndex } }),
      // business_app 그룹 선택
      selectBusinessGroup: (groupIndex) => set({ selection: { type: 'business_group', groupIndex } }),
      // 선택 초기화
      clearSelection: () => set({ selection: { type: 'none' } }),
      setSidebarOpen: (open) =>
        set((state) =>
          open
            ? {
                sidebarOpen: true,
                sidebarWidth: clampSidebarWidth(state.expandedSidebarWidth),
              }
            : {
                sidebarOpen: false,
                sidebarWidth: SIDEBAR_COLLAPSED_WIDTH_PX,
                expandedSidebarWidth: clampSidebarWidth(state.sidebarWidth),
              },
        ),
      setSidebarWidth: (width) =>
        set({
          sidebarOpen: true,
          sidebarWidth: clampSidebarWidth(width),
          expandedSidebarWidth: clampSidebarWidth(width),
        }),
      expandSidebar: () =>
        set((state) => ({
          sidebarOpen: true,
          sidebarWidth: clampSidebarWidth(state.expandedSidebarWidth),
        })),
      collapseSidebar: () =>
        set((state) => ({
          sidebarOpen: false,
          sidebarWidth: SIDEBAR_COLLAPSED_WIDTH_PX,
          expandedSidebarWidth: clampSidebarWidth(state.sidebarWidth),
        })),
      toggleSidebar: () =>
        set((state) =>
          state.sidebarOpen
            ? {
                sidebarOpen: false,
                sidebarWidth: SIDEBAR_COLLAPSED_WIDTH_PX,
                expandedSidebarWidth: clampSidebarWidth(state.sidebarWidth),
              }
            : {
                sidebarOpen: true,
                sidebarWidth: clampSidebarWidth(state.expandedSidebarWidth),
              },
        ),
      setEditMode: (enabled) => set({ isEditMode: enabled }),
      setProfileModalOpen: (open) => set({ isProfileModalOpen: open }),
      setTopPanelHeightPercent: (updater) =>
        set((state) => ({
          topPanelHeightPercent:
            typeof updater === 'function' ? updater(state.topPanelHeightPercent) : updater,
        })),
    }),
    {
      name: EQP_UI_SELECTION_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      // 선택 상태만 sessionStorage에 보관하고, 나머지 UI 상태는 휘발 상태로 유지합니다.
      partialize: (state): EqpUiPersistedState => ({
        selection: state.selection,
      }),
    },
  ),
)
