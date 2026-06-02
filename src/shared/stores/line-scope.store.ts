import { create } from 'zustand'

/**
 * 전체 라인을 의미하는 스코프 값입니다.
 */
export const ALL_LINES_VALUE = 'ALL'

interface LineScopeState {
  /** 선택된 라인 스코프(line_code). 'ALL' 이면 전체 라인. */
  selectedLineValue: string
  setSelectedLineValue: (selectedLineValue: string) => void
}

/**
 * 상단바에서 선택한 라인 스코프를 전역으로 보관합니다.
 *
 * <p>AppTopBar 는 전 페이지에 렌더되므로 라인 선택은 특정 feature store 가 아닌
 * 전역 shared store 에 둡니다(페이지 이동 시 선택이 초기화되지 않도록).</p>
 */
export const useLineScopeStore = create<LineScopeState>()((set) => ({
  selectedLineValue: ALL_LINES_VALUE,
  setSelectedLineValue: (selectedLineValue) => set({ selectedLineValue }),
}))
