import { useCallback, useState } from 'react'

export type ColumnWidthMap = Record<string, number>

export interface UseGridResizeResult {
  widths: ColumnWidthMap
  setColumnWidth: (columnKey: string, width: number) => void
  /**
   * header 우측 경계 drag 시작. pointerdown 시점의 clientX 와 헤더 cell 의 현재 px 너비를
   * 받아 window pointermove 로 deltaX 를 더해 너비를 갱신한다 (pointerup 에서 자동 해제).
   */
  beginResize: (columnKey: string, startX: number, startWidth: number) => void
  resetColumnWidth: (columnKey: string) => void
  resetAll: () => void
}

// 컬럼이 사라져 잡을 수 없게 되는 것을 막는 최소 너비(px).
const MIN_COLUMN_WIDTH = 48

/**
 * SelectableTable 의 컬럼 너비 상태 훅.
 *
 * `widths` 는 px override map. header 우측 경계 drag 는 `beginResize` 로 시작하고,
 * window pointermove 의 clientX − startX 만큼 startWidth 에 더해 즉시 반영한다.
 */
export const useGridResize = (): UseGridResizeResult => {
  const [widths, setWidths] = useState<ColumnWidthMap>({})

  const setColumnWidth = useCallback((columnKey: string, width: number) => {
    setWidths((previous) => ({ ...previous, [columnKey]: width }))
  }, [])

  const beginResize = useCallback(
    (columnKey: string, startX: number, startWidth: number) => {
      const handleMove = (event: PointerEvent) => {
        const next = Math.max(MIN_COLUMN_WIDTH, startWidth + (event.clientX - startX))
        setColumnWidth(columnKey, next)
      }
      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
      }
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
    },
    [setColumnWidth],
  )

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

  return { widths, setColumnWidth, beginResize, resetColumnWidth, resetAll }
}
