import { create } from 'zustand'
import {
  clampSidebarWidth,
  SIDEBAR_COLLAPSED_WIDTH_PX,
  SIDEBAR_DEFAULT_WIDTH_PX,
} from '@/shared/layout/sidebar-layout'
import { createEmptyFlowDraft, type FlowDraft } from '../lib/model-flow-editor'
import type { ModelDetailNode, ModelInfo, ModelOpenedTab } from '../types/model.types'

interface ModelUiState {
  selectedModelVersionKey: number | null
  sidebarOpen: boolean
  sidebarWidth: number
  expandedSidebarWidth: number
  openedTabs: ModelOpenedTab[]
  activeTab: number | null
  detailNode: ModelDetailNode | null
  detailNodeByTab: Record<number, ModelDetailNode>
  isEditMode: boolean
  isCheckInModalOpen: boolean
  /** 상하 패널 분리 핸들의 상단 패널 높이 비율(%) */
  topPanelHeightPercent: number
  /**
   * 좌측 사이드바에서 선택된 Message Flow 의 flowId. null = Reference 영역 모드.
   * draftFlow 와 상호 배타 — draftFlow 가 채워지면 selectedFlowId 는 null 로 강제됩니다.
   */
  selectedFlowId: number | null
  /**
   * "+ Add Flow" 로 생성된 unsaved Flow draft. null = draft 없음.
   * Identity 두 값을 채운 후 첫 저장 시 POST /flows 로 생성되며, 성공하면
   * draftFlow=null + selectedFlowId=발급된 flowId 로 전환됩니다.
   */
  draftFlow: FlowDraft | null
  setSelectedModelVersionKey: (modelVersionKey: number | null) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  expandSidebar: () => void
  collapseSidebar: () => void
  toggleSidebar: () => void
  openModelTab: (model: ModelInfo) => void
  closeModelTab: (modelVersionKey: number) => void
  setActiveTab: (modelVersionKey: number | null) => void
  setDetailNode: (node: ModelDetailNode | null) => void
  setDetailNodeForTab: (modelVersionKey: number, node: ModelDetailNode) => void
  setEditMode: (enabled: boolean) => void
  setCheckInModalOpen: (open: boolean) => void
  /**
   * 상하 패널 높이 비율을 갱신합니다.
   * 직접 값 또는 이전 값을 받는 updater 함수 모두 허용합니다.
   */
  setTopPanelHeightPercent: (updater: number | ((prev: number) => number)) => void
  /**
   * 좌측 트리에서 Flow 를 선택합니다.
   * Flow 선택은 draftFlow 와 상호 배타 — draftFlow 도 함께 정리합니다.
   */
  setSelectedFlowId: (flowId: number | null) => void
  /**
   * "+ Add Flow" 클릭 시 빈 FlowDraft 를 채워 unsaved 상태로 전환합니다.
   * selectedFlowId 는 null 로 정리되어 우측 패널이 draft 카드를 렌더하게 합니다.
   */
  startDraftFlow: () => void
  /**
   * draftFlow 를 비웁니다 (취소 또는 저장 완료 후 호출).
   */
  clearDraftFlow: () => void
  handleModelVersionsRemoved: (
    removedModelVersionKeys: number[],
    fallbackSelectedModelVersionKey?: number | null,
  ) => void
  handleBranchCommitSuccess: (
    branchModelKey: number,
    committedParentModelVersionKey: number | null,
  ) => void
  reset: () => void
}

/** 상하 패널 초기 높이 비율(%) */
export const MODEL_PANEL_INITIAL_TOP_PERCENT = 35

/**
 * ModelInfo를 Detail 탭 데이터 모델로 변환합니다.
 */
const toOpenedTab = (model: ModelInfo): ModelOpenedTab => ({
  modelVersionKey: model.modelVersionKey,
  modelKey: model.modelKey,
  modelName: model.modelName,
  modelVersion: model.modelVersion,
  commInterface: model.commInterface,
})

/**
 * Model 화면 전역 UI 상태 저장소입니다.
 */
export const useModelUiStore = create<ModelUiState>((set) => ({
  selectedModelVersionKey: null,
  sidebarOpen: true,
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH_PX,
  expandedSidebarWidth: SIDEBAR_DEFAULT_WIDTH_PX,
  openedTabs: [],
  activeTab: null,
  detailNode: null,
  detailNodeByTab: {},
  isEditMode: false,
  isCheckInModalOpen: false,
  topPanelHeightPercent: MODEL_PANEL_INITIAL_TOP_PERCENT,
  selectedFlowId: null,
  draftFlow: null,
  setSelectedModelVersionKey: (modelVersionKey) => set({ selectedModelVersionKey: modelVersionKey }),
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
  openModelTab: (model) =>
    set((state) => {
      const tab = toOpenedTab(model)
      const alreadyOpened = state.openedTabs.some(
        (openedTab) => openedTab.modelVersionKey === tab.modelVersionKey,
      )
      const nextTabs = alreadyOpened ? state.openedTabs : [...state.openedTabs, tab]
      const nextDetailNode =
        state.detailNodeByTab[tab.modelVersionKey] ?? state.detailNode ?? 'model-parameter'

      return {
        openedTabs: nextTabs,
        activeTab: tab.modelVersionKey,
        selectedModelVersionKey: tab.modelVersionKey,
        detailNode: nextDetailNode,
        detailNodeByTab: {
          ...state.detailNodeByTab,
          [tab.modelVersionKey]: nextDetailNode,
        },
      }
    }),
  closeModelTab: (modelVersionKey) =>
    set((state) => {
      const nextTabs = state.openedTabs.filter((tab) => tab.modelVersionKey !== modelVersionKey)
      const nextDetailNodeByTab = { ...state.detailNodeByTab }
      delete nextDetailNodeByTab[modelVersionKey]

      if (state.activeTab !== modelVersionKey) {
        const nextSelectedModelVersionKey =
          state.selectedModelVersionKey === modelVersionKey
            ? (state.activeTab ?? nextTabs[nextTabs.length - 1]?.modelVersionKey ?? null)
            : state.selectedModelVersionKey

        return {
          openedTabs: nextTabs,
          detailNodeByTab: nextDetailNodeByTab,
          selectedModelVersionKey: nextSelectedModelVersionKey,
        }
      }

      const nextActiveTab = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].modelVersionKey : null

      return {
        openedTabs: nextTabs,
        activeTab: nextActiveTab,
        // 마지막 탭을 닫아도 Model 정보 레이아웃은 유지해야 하므로 선택 키를 보존합니다.
        selectedModelVersionKey: nextActiveTab ?? state.selectedModelVersionKey ?? modelVersionKey,
        detailNode: nextActiveTab !== null ? (nextDetailNodeByTab[nextActiveTab] ?? null) : null,
        detailNodeByTab: nextDetailNodeByTab,
      }
    }),
  setActiveTab: (modelVersionKey) =>
    set((state) => ({
      activeTab: modelVersionKey,
      selectedModelVersionKey: modelVersionKey,
      detailNode: modelVersionKey !== null ? (state.detailNodeByTab[modelVersionKey] ?? null) : null,
    })),
  setDetailNode: (node) =>
    set((state) => {
      if (state.activeTab === null || node === null) {
        return { detailNode: node }
      }

      return {
        detailNode: node,
        detailNodeByTab: {
          ...state.detailNodeByTab,
          [state.activeTab]: node,
        },
      }
    }),
  setDetailNodeForTab: (modelVersionKey, node) =>
    set((state) => ({
      detailNodeByTab: {
        ...state.detailNodeByTab,
        [modelVersionKey]: node,
      },
      detailNode: state.activeTab === modelVersionKey ? node : state.detailNode,
    })),
  setEditMode: (enabled) => set({ isEditMode: enabled }),
  setCheckInModalOpen: (open) => set({ isCheckInModalOpen: open }),
  setTopPanelHeightPercent: (updater) =>
    set((state) => ({
      topPanelHeightPercent:
        typeof updater === 'function' ? updater(state.topPanelHeightPercent) : updater,
    })),
  setSelectedFlowId: (flowId) =>
    // Flow 선택은 draftFlow 와 상호 배타 — Reference 노드 / Flow 카드 / draft 카드 중
    // 하나만 우측 패널에 노출됩니다.
    set({ selectedFlowId: flowId, draftFlow: null }),
  startDraftFlow: () =>
    set({ draftFlow: createEmptyFlowDraft(), selectedFlowId: null }),
  clearDraftFlow: () => set({ draftFlow: null }),
  handleModelVersionsRemoved: (removedModelVersionKeys, fallbackSelectedModelVersionKey = null) =>
    set((state) => {
      const removedVersionKeySet = new Set(removedModelVersionKeys)
      const nextTabs = state.openedTabs.filter(
        (tab) => !removedVersionKeySet.has(tab.modelVersionKey),
      )
      const nextDetailNodeByTab = Object.fromEntries(
        Object.entries(state.detailNodeByTab).filter(
          ([modelVersionKey]) => !removedVersionKeySet.has(Number(modelVersionKey)),
        ),
      )

      const hasActiveTab =
        state.activeTab !== null && !removedVersionKeySet.has(state.activeTab)
      const nextActiveTab = hasActiveTab
        ? state.activeTab
        : (nextTabs[nextTabs.length - 1]?.modelVersionKey ?? null)

      const hasSelectedModelVersion =
        state.selectedModelVersionKey !== null &&
        !removedVersionKeySet.has(state.selectedModelVersionKey)
      const nextSelectedModelVersionKey = hasSelectedModelVersion
        ? state.selectedModelVersionKey
        : (fallbackSelectedModelVersionKey ?? nextActiveTab)

      return {
        openedTabs: nextTabs,
        activeTab: nextActiveTab,
        selectedModelVersionKey: nextSelectedModelVersionKey ?? null,
        detailNode: nextActiveTab !== null ? (nextDetailNodeByTab[nextActiveTab] ?? null) : null,
        detailNodeByTab: nextDetailNodeByTab,
        isEditMode: hasActiveTab ? state.isEditMode : false,
        isCheckInModalOpen: hasActiveTab ? state.isCheckInModalOpen : false,
      }
    }),
  handleBranchCommitSuccess: (branchModelKey, committedParentModelVersionKey) =>
    set((state) => {
      const nextTabs = state.openedTabs.filter((tab) => tab.modelKey !== branchModelKey)
      const nextDetailNodeByTab = Object.fromEntries(
        Object.entries(state.detailNodeByTab).filter(([modelVersionKey]) =>
          nextTabs.some((tab) => tab.modelVersionKey === Number(modelVersionKey)),
        ),
      )

      const hasActiveTab =
        state.activeTab !== null &&
        nextTabs.some((tab) => tab.modelVersionKey === state.activeTab)
      const nextActiveTab = hasActiveTab ? state.activeTab : null

      const nextSelectedModelVersionKey =
        committedParentModelVersionKey ??
        (state.selectedModelVersionKey !== null &&
        nextTabs.some((tab) => tab.modelVersionKey === state.selectedModelVersionKey)
          ? state.selectedModelVersionKey
          : nextActiveTab)

      return {
        openedTabs: nextTabs,
        activeTab: nextActiveTab,
        selectedModelVersionKey: nextSelectedModelVersionKey ?? null,
        detailNode: nextActiveTab !== null ? (nextDetailNodeByTab[nextActiveTab] ?? null) : null,
        detailNodeByTab: nextDetailNodeByTab,
        isEditMode: false,
        isCheckInModalOpen: false,
      }
    }),
  reset: () =>
    set({
      selectedModelVersionKey: null,
      sidebarOpen: true,
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH_PX,
      expandedSidebarWidth: SIDEBAR_DEFAULT_WIDTH_PX,
      openedTabs: [],
      activeTab: null,
      detailNode: null,
      detailNodeByTab: {},
      isEditMode: false,
      isCheckInModalOpen: false,
      topPanelHeightPercent: MODEL_PANEL_INITIAL_TOP_PERCENT,
      selectedFlowId: null,
      draftFlow: null,
    }),
}))
