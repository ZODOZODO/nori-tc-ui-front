import { create } from 'zustand'

interface LineScopeState {
  /** 선택된 라인 스코프(line_code). 라인 목록 로드 전 초기값은 '' 이며, 로드되면 첫 라인으로 시드된다. */
  selectedLineValue: string
  setSelectedLineValue: (selectedLineValue: string) => void
}

/**
 * 상단바에서 선택한 라인 스코프를 전역으로 보관합니다.
 *
 * <p>AppTopBar 는 전 페이지에 렌더되므로 라인 선택은 특정 feature store 가 아닌
 * 전역 shared store 에 둡니다(페이지 이동 시 선택이 초기화되지 않도록). "전체 라인" 스코프는
 * 없다 — 항상 단일 라인 1개가 선택된다(LineScopeSelector 가 라인 목록 로드 시 첫 라인으로 시드).</p>
 */
export const useLineScopeStore = create<LineScopeState>()((set) => ({
  selectedLineValue: '',
  setSelectedLineValue: (selectedLineValue) => set({ selectedLineValue }),
}))
