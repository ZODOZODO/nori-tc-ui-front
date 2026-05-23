export interface UseGridVirtualOptions {
  itemCount: number
  estimatedRowHeight: number
  overscan?: number
}

export interface VirtualRowDescriptor {
  index: number
  start: number
  size: number
}

export interface UseGridVirtualResult {
  totalSize: number
  virtualRows: VirtualRowDescriptor[]
}

/**
 * SelectableTable 의 row 가상화 훅.
 *
 * R1 시점에는 인터페이스만 노출하고 모든 row 를 그대로 반환 (no-op). R6 PR 에서
 * `@tanstack/react-virtual` 의 `useVirtualizer` 로 교체됩니다.
 */
export const useGridVirtual = ({
  itemCount,
  estimatedRowHeight,
}: UseGridVirtualOptions): UseGridVirtualResult => {
  const virtualRows: VirtualRowDescriptor[] = []
  for (let index = 0; index < itemCount; index += 1) {
    virtualRows.push({
      index,
      start: index * estimatedRowHeight,
      size: estimatedRowHeight,
    })
  }
  return {
    totalSize: itemCount * estimatedRowHeight,
    virtualRows,
  }
}
