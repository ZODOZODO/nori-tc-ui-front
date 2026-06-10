import { create } from 'zustand'
import type { LiveMapStatusFilter } from '../types/live-map.types'

const MIN_ZOOM_LEVEL = 0.85
const MAX_ZOOM_LEVEL = 1.35
const DEFAULT_ZOOM_LEVEL = 1

const clampZoomLevel = (zoomLevel: number): number =>
  Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, Number(zoomLevel.toFixed(2))))

interface LiveMapUiState {
  searchKeyword: string
  selectedStatus: LiveMapStatusFilter
  selectedEqpId: string | null
  isLayoutEditEnabled: boolean
  zoomLevel: number
  lastSyncAt: number
  setSearchKeyword: (searchKeyword: string) => void
  setSelectedStatus: (selectedStatus: LiveMapStatusFilter) => void
  setSelectedEqpId: (selectedEqpId: string | null) => void
  setLayoutEditEnabled: (isLayoutEditEnabled: boolean) => void
  setZoomLevel: (zoomLevel: number) => void
  resetZoom: () => void
  zoomIn: () => void
  zoomOut: () => void
  markSynced: (timestamp?: number) => void
  reset: () => void
}

const createInitialState = () => ({
  searchKeyword: '',
  selectedStatus: 'ALL' as LiveMapStatusFilter,
  selectedEqpId: null,
  isLayoutEditEnabled: false,
  zoomLevel: DEFAULT_ZOOM_LEVEL,
  lastSyncAt: Date.now(),
})

/**
 * Live Map 페이지의 클라이언트 선택 상태를 관리합니다.
 * 그룹 배치는 useLiveMapFlow(canvas_json.flow 영속) 가 담당한다 — 여기는 휘발 UI 상태만.
 */
export const useLiveMapUiStore = create<LiveMapUiState>()((set) => ({
  ...createInitialState(),
  setSearchKeyword: (searchKeyword) => set({ searchKeyword }),
  setSelectedStatus: (selectedStatus) => set({ selectedStatus }),
  setSelectedEqpId: (selectedEqpId) => set({ selectedEqpId }),
  setLayoutEditEnabled: (isLayoutEditEnabled) => set({ isLayoutEditEnabled }),
  setZoomLevel: (zoomLevel) => set({ zoomLevel: clampZoomLevel(zoomLevel) }),
  resetZoom: () => set({ zoomLevel: DEFAULT_ZOOM_LEVEL }),
  zoomIn: () => set((state) => ({ zoomLevel: clampZoomLevel(state.zoomLevel + 0.1) })),
  zoomOut: () => set((state) => ({ zoomLevel: clampZoomLevel(state.zoomLevel - 0.1) })),
  markSynced: (timestamp = Date.now()) => set({ lastSyncAt: timestamp }),
  reset: () => set(createInitialState()),
}))
