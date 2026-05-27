import { useVirtualizer } from '@tanstack/react-virtual'

export interface UseGridVirtualOptions {
  enabled: boolean
  itemCount: number
  estimatedRowHeight: number
  overscan?: number
  getScrollElement: () => HTMLElement | null
}

export interface VirtualRowDescriptor {
  index: number
  start: number
  size: number
}

export interface UseGridVirtualResult {
  enabled: boolean
  totalSize: number
  virtualRows: VirtualRowDescriptor[]
  /** 윈도우 위/아래의 빈 높이 — `<tr>` spacer 로 렌더해 정상 flow(컬럼폭/sticky)를 유지한다. */
  paddingTop: number
  paddingBottom: number
  /**
   * 스크롤 콘텐츠 기준 Y offset(= scrollTop + 컨테이너 내 pointerY)을 row index 로 변환.
   * 가상화로 off-screen 행이 DOM 에 없을 때 drag 범위 선택의 행을 직접 계산하기 위함.
   */
  getRowIndexForOffset: (contentOffset: number) => number | null
}

const DEFAULT_OVERSCAN = 8

/**
 * SelectableTable 의 row 가상화 훅 — `@tanstack/react-virtual` 의 `useVirtualizer` wiring.
 *
 * headless 라 offset 만 반환하고 `<tr>`/`<td>` 렌더는 SelectableTable 이 padding-spacer
 * 기법(상/하단 빈 `<tr>` 높이 패딩 + 윈도우 행만 렌더)으로 직접 한다 → shadcn `<Table>`
 * DOM / sticky 첫 컬럼 / table-auto 컬럼폭 보존(absolute translateY 배제).
 *
 * `enabled=false` 면 가상화를 끄고 빈 결과를 반환한다 (SelectableTable 이 전체 행 렌더).
 * `useVirtualizer` 는 hooks 규칙상 무조건 호출하되 count=0 으로 비활성한다.
 */
export const useGridVirtual = ({
  enabled,
  itemCount,
  estimatedRowHeight,
  overscan = DEFAULT_OVERSCAN,
  getScrollElement,
}: UseGridVirtualOptions): UseGridVirtualResult => {
  // useVirtualizer 는 매 렌더 새 함수(getVirtualItems 등)를 반환해 React Compiler 가
  // 메모이즈를 건너뛴다(설계상 한계). 소비처(SelectableTable)는 getRowIndexForOffset 을
  // ref 로 받아 stale 참조를 피하므로 이 hook 한정 incompatible-library 경고를 끈다.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: enabled ? itemCount : 0,
    getScrollElement,
    estimateSize: () => estimatedRowHeight,
    overscan,
  })

  if (!enabled) {
    return {
      enabled: false,
      totalSize: 0,
      virtualRows: [],
      paddingTop: 0,
      paddingBottom: 0,
      getRowIndexForOffset: () => null,
    }
  }

  const items = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()
  const paddingTop = items.length > 0 ? items[0].start : 0
  const paddingBottom = items.length > 0 ? totalSize - items[items.length - 1].end : 0

  return {
    enabled: true,
    totalSize,
    virtualRows: items.map((item) => ({
      index: item.index,
      start: item.start,
      size: item.size,
    })),
    paddingTop,
    paddingBottom,
    getRowIndexForOffset: (contentOffset) =>
      virtualizer.getVirtualItemForOffset(contentOffset)?.index ?? null,
  }
}
