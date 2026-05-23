import { useCallback, useState } from 'react'

/**
 * 컬럼 정렬 방향 — `null` 은 정렬 미적용 (원본 순서 유지).
 */
export type SortDirection = 'asc' | 'desc' | null

export interface GridSortState {
  columnKey: string | null
  direction: SortDirection
}

export interface UseGridSortResult {
  sort: GridSortState
  toggleColumn: (columnKey: string) => void
  clearSort: () => void
}

/**
 * SelectableTable 의 컬럼 정렬 상태 훅.
 *
 * R1 시점에는 인터페이스만 노출 — 실제 정렬 로직은 R6 PR 에서 SelectableTable
 * 본체에 wiring 됩니다.
 */
export const useGridSort = (): UseGridSortResult => {
  const [sort, setSort] = useState<GridSortState>({ columnKey: null, direction: null })

  const toggleColumn = useCallback((columnKey: string) => {
    setSort((previous) => {
      if (previous.columnKey !== columnKey) {
        return { columnKey, direction: 'asc' }
      }
      if (previous.direction === 'asc') {
        return { columnKey, direction: 'desc' }
      }
      return { columnKey: null, direction: null }
    })
  }, [])

  const clearSort = useCallback(() => {
    setSort({ columnKey: null, direction: null })
  }, [])

  return { sort, toggleColumn, clearSort }
}
