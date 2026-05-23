import { useCallback, useState } from 'react'

export type ColumnWidthMap = Record<string, number>

export interface UseGridResizeResult {
  widths: ColumnWidthMap
  setColumnWidth: (columnKey: string, width: number) => void
  resetColumnWidth: (columnKey: string) => void
  resetAll: () => void
}

/**
 * SelectableTable 의 컬럼 너비 상태 훅.
 *
 * R1 시점에는 인터페이스만 노출 — header 경계 drag 와 px 계산은 R6 PR 에서 추가됩니다.
 */
export const useGridResize = (): UseGridResizeResult => {
  const [widths, setWidths] = useState<ColumnWidthMap>({})

  const setColumnWidth = useCallback((columnKey: string, width: number) => {
    setWidths((previous) => ({ ...previous, [columnKey]: width }))
  }, [])

  const resetColumnWidth = useCallback((columnKey: string) => {
    setWidths((previous) => {
      if (!(columnKey in previous)) {
        return previous
      }
      const next = { ...previous }
      delete next[columnKey]
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    setWidths({})
  }, [])

  return { widths, setColumnWidth, resetColumnWidth, resetAll }
}
