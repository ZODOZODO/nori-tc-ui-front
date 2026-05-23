import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GridCoord, GridRange } from '@/shared/components/SelectableTable/types'

export type { GridCoord, GridRange }

export interface UseGridRangeSelectionResult {
  range: GridRange | null
  anchor: GridCoord | null
  isSelecting: boolean
  beginSelection: (coord: GridCoord) => void
  extendSelection: (coord: GridCoord) => void
  endSelection: () => void
  clearSelection: () => void
  isCellInRange: (rowIdx: number, colIdx: number) => boolean
  isAnchorCell: (rowIdx: number, colIdx: number) => boolean
}

const normalizeRange = (anchor: GridCoord, focus: GridCoord): GridRange => ({
  startRowIdx: Math.min(anchor.rowIdx, focus.rowIdx),
  endRowIdx: Math.max(anchor.rowIdx, focus.rowIdx),
  startColIdx: Math.min(anchor.colIdx, focus.colIdx),
  endColIdx: Math.max(anchor.colIdx, focus.colIdx),
})

/**
 * Excel-스타일 셀 사각형 영역 선택 상태 훅.
 *
 * - beginSelection: pointerdown 진입 셀을 anchor 로 잡고 focus 도 동일하게 초기화.
 * - extendSelection: pointer 가 들어온 셀로 focus 만 이동. anchor 는 그대로.
 * - endSelection: pointerup 으로 드래그 종료. 윈도우 전역 pointerup 도 자동 감지하여
 *   드래그가 grid 밖에서 끝나도 안전하게 종료한다.
 */
export const useGridRangeSelection = (): UseGridRangeSelectionResult => {
  const [anchor, setAnchor] = useState<GridCoord | null>(null)
  const [focus, setFocus] = useState<GridCoord | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const isSelectingRef = useRef(false)

  useEffect(() => {
    const handleUp = () => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false
        setIsSelecting(false)
      }
    }
    window.addEventListener('pointerup', handleUp)
    return () => window.removeEventListener('pointerup', handleUp)
  }, [])

  const beginSelection = useCallback((coord: GridCoord) => {
    setAnchor(coord)
    setFocus(coord)
    isSelectingRef.current = true
    setIsSelecting(true)
  }, [])

  const extendSelection = useCallback((coord: GridCoord) => {
    if (!isSelectingRef.current) {
      return
    }
    setFocus(coord)
  }, [])

  const endSelection = useCallback(() => {
    isSelectingRef.current = false
    setIsSelecting(false)
  }, [])

  const clearSelection = useCallback(() => {
    setAnchor(null)
    setFocus(null)
    isSelectingRef.current = false
    setIsSelecting(false)
  }, [])

  const range = useMemo<GridRange | null>(
    () => (anchor && focus ? normalizeRange(anchor, focus) : null),
    [anchor, focus],
  )

  const isCellInRange = useCallback(
    (rowIdx: number, colIdx: number) => {
      if (!range) {
        return false
      }
      return (
        rowIdx >= range.startRowIdx &&
        rowIdx <= range.endRowIdx &&
        colIdx >= range.startColIdx &&
        colIdx <= range.endColIdx
      )
    },
    [range],
  )

  const isAnchorCell = useCallback(
    (rowIdx: number, colIdx: number) =>
      anchor !== null && rowIdx === anchor.rowIdx && colIdx === anchor.colIdx,
    [anchor],
  )

  return {
    range,
    anchor,
    isSelecting,
    beginSelection,
    extendSelection,
    endSelection,
    clearSelection,
    isCellInRange,
    isAnchorCell,
  }
}
