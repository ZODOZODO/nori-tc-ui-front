import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/i18n-context'
import { useGridRangeSelection } from '@/shared/hooks/useGridRangeSelection'
import { useGridResize } from '@/shared/hooks/useGridResize'
import { useGridSort } from '@/shared/hooks/useGridSort'
import { useGridVirtual } from '@/shared/hooks/useGridVirtual'
import type {
  ColumnDef,
  GridRange,
  SelectableTableActionColumn,
  SelectableTableFeatures,
  SelectableTablePasteHandler,
} from './types'

interface SelectableTableProps<TRow> {
  columns: readonly ColumnDef<TRow>[]
  rows: readonly TRow[]
  rowKey: (row: TRow, rowIdx: number) => string | number
  features?: SelectableTableFeatures
  actionColumn?: SelectableTableActionColumn<TRow>
  onCellPaste?: SelectableTablePasteHandler<TRow>
  emptyState?: ReactNode
  testId?: string
  containerClassName?: string
  tableClassName?: string
  /**
   * 행 단위 wrapper. 셀들의 ReactNode (TableCell 묶음 + actionCell) 를 받아 페이지별로
   * `<TableRow>` 합성을 가져간다. row 단위 `data-testid` (DLQ 패널), shadcn `<ContextMenu>`
   * `<ContextMenuTrigger asChild>` (DeployMonitorPanel / EqpInfoTable / GatewayGroupTable),
   * row onClick 핸들러 등 페이지 책임의 row level 분기를 보존하기 위한 escape hatch.
   *
   * 단 선택 행 하이라이트(`data-state="selected"`)는 표시하지 않는다 — 사용자 결정으로
   * 모든 테이블 공통 금지(베이스 `<TableRow>` 에서 `data-[state=selected]` 스타일 제거).
   *
   * `children` 은 `TableCell` 들의 fragment 이며, wrapper 는 자기 `<TableRow ...>{children}</TableRow>`
   * 를 만들어 반환한다. 미지정 시 SelectableTable 이 기본 `<TableRow>` 로 렌더.
   */
  wrapRow?: (row: TRow, rowIdx: number, children: ReactNode) => ReactNode
}

/**
 * SelectableTable 컨테이너 안에서 셀이 native paste/copy 를 우선 처리해야 할 요소인지 판정합니다.
 * input / select / textarea / button 의 native 동작은 그대로 보존합니다.
 */
const isNativeInteractiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
    return true
  }
  return Boolean(target.closest('input, select, textarea, button'))
}

const buildTsv = <TRow,>(
  rows: readonly TRow[],
  columns: readonly ColumnDef<TRow>[],
  range: GridRange,
): string => {
  const lines: string[] = []
  for (let rowIdx = range.startRowIdx; rowIdx <= range.endRowIdx; rowIdx += 1) {
    const row = rows[rowIdx]
    if (!row) {
      continue
    }
    const cells: string[] = []
    for (let colIdx = range.startColIdx; colIdx <= range.endColIdx; colIdx += 1) {
      const column = columns[colIdx]
      cells.push(column ? column.accessor(row) : '')
    }
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}

/**
 * Excel TSV 를 2 차원 배열로 파싱합니다. (Windows \r\n, mac \r, web \n 정규화 + trailing newline 제거)
 */
const parseTsv = (text: string): string[][] => {
  const normalized = text.replace(/\r\n?/g, '\n')
  const stripped = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized
  return stripped.split('\n').map((line) => line.split('\t'))
}

const stickyHeadStyle = (sticky: boolean | undefined): CSSProperties | undefined =>
  sticky ? { left: 0, position: 'sticky', top: 0, zIndex: 40 } : undefined

const stickyCellStyle = (sticky: boolean | undefined): CSSProperties | undefined =>
  sticky ? { left: 0, position: 'sticky', zIndex: 20 } : undefined

// 가상화 추정 행 높이(px) — 셀 inner div min-h-8(32) + py-1 + TableCell p-1 근사.
const ESTIMATED_ROW_HEIGHT = 48
// drag 가 컨테이너 상/하단 EDGE 안에 들어오면 자동 스크롤 (가상화 off-screen 행 선택).
const AUTO_SCROLL_EDGE = 28
const AUTO_SCROLL_STEP = 18

/**
 * shadcn `<Table>` 기반 제네릭 셀 영역 선택 / Ctrl+C TSV / Ctrl+V paste 테이블.
 *
 * 셀 선택 표식은 중립(anchor foreground/10, range foreground/05)으로 — 코랄은 포인트로만
 * 쓰고 셀 범위 선택 같은 보조 affordance 는 무채색으로 둔다(사용자 결정). 셀 내부 콘텐츠는 `column.renderCell` 로 위임하여
 * picker/select/Input 같은 페이지별 분기를 보존합니다 (R3 이후 활용).
 */
export const SelectableTable = <TRow,>({
  columns,
  rows,
  rowKey,
  features,
  actionColumn,
  onCellPaste,
  emptyState,
  testId,
  containerClassName,
  tableClassName,
  wrapRow,
}: SelectableTableProps<TRow>) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // 가상화 drag 중 pointer 가 spacer 위에 있어 colIdx 를 못 읽을 때 직전 colIdx 유지.
  const lastColIdxRef = useRef<number | null>(null)
  const {
    range,
    anchor,
    isSelecting,
    beginSelection,
    extendSelection,
    isCellInRange,
    isAnchorCell,
    clearSelection,
  } = useGridRangeSelection()
  const [editing, setEditing] = useState<{ rowIdx: number; colIdx: number } | null>(null)

  // 편집 종료 시 컨테이너로 focus 환원 → 다음 Ctrl+C/V 가 grid 에서 동작.
  useEffect(() => {
    if (!editing) {
      containerRef.current?.focus()
    }
  }, [editing])

  const { t } = useI18n()

  const rangeCopyEnabled = features?.rangeCopy ?? true
  const rangePasteEnabled =
    features?.rangePaste ?? Boolean(onCellPaste && columns.some((column) => column.editable))

  const sortEnabled = features?.sortable ?? false
  const { sort, toggleColumn } = useGridSort()

  const resizeEnabled = features?.resizable ?? false
  const { widths, beginResize } = useGridResize()

  const handleResizePointerDown = useCallback(
    (columnKey: string) => (event: PointerEvent<HTMLSpanElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const headCell = event.currentTarget.closest('th')
      const startWidth = headCell ? headCell.getBoundingClientRect().width : 0
      beginResize(columnKey, event.clientX, startWidth)
    },
    [beginResize],
  )

  // px override 가 있으면 헤더/셀에 동일 px 를 강제해 컬럼 정렬을 유지한다.
  const columnSizeStyle = (column: ColumnDef<TRow>): CSSProperties => {
    const override = widths[column.key]
    if (override !== undefined) {
      const px = `${override}px`
      return { width: px, minWidth: px, maxWidth: px }
    }
    return { width: column.width, minWidth: column.width, maxWidth: column.maxWidth }
  }

  // 정렬 활성 시 단일 정렬 배열을 만들어 buildTsv / range / rowKey / wrapRow / paste 모두
  // 같은 배열을 쓰게 한다 (rowIdx ↔ row 정합 유지). 정렬 off(기본) 면 원본 순서 그대로.
  const displayedRows = useMemo<readonly TRow[]>(() => {
    if (!sortEnabled || !sort.columnKey || !sort.direction) {
      return rows
    }
    const column = columns.find((candidate) => candidate.key === sort.columnKey)
    if (!column) {
      return rows
    }
    const sorted = [...rows].sort((a, b) =>
      column.accessor(a).localeCompare(column.accessor(b)),
    )
    return sort.direction === 'desc' ? sorted.reverse() : sorted
  }, [sortEnabled, sort.columnKey, sort.direction, columns, rows])

  const beginEdit = useCallback((rowIdx: number, colIdx: number) => {
    setEditing({ rowIdx, colIdx })
  }, [])

  const endEdit = useCallback(() => {
    setEditing(null)
  }, [])

  const handleCellPointerDown = useCallback(
    (rowIdx: number, colIdx: number) => (event: PointerEvent<HTMLDivElement>) => {
      if (isNativeInteractiveTarget(event.target)) {
        return
      }
      event.preventDefault()
      containerRef.current?.focus()
      lastColIdxRef.current = colIdx
      beginSelection({ rowIdx, colIdx })
    },
    [beginSelection],
  )

  const handleCellPointerEnter = useCallback(
    (rowIdx: number, colIdx: number) => () => {
      lastColIdxRef.current = colIdx
      extendSelection({ rowIdx, colIdx })
    },
    [extendSelection],
  )

  const handleCopy = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (!rangeCopyEnabled || !range) {
        return
      }
      if (isNativeInteractiveTarget(event.target)) {
        return
      }
      const tsv = buildTsv(displayedRows, columns, range)
      event.clipboardData?.setData('text/plain', tsv)
      event.preventDefault()
    },
    [rangeCopyEnabled, range, displayedRows, columns],
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      if (!rangePasteEnabled || !onCellPaste || !anchor) {
        return
      }
      if (isNativeInteractiveTarget(event.target)) {
        return
      }
      const text = event.clipboardData?.getData('text/plain')
      if (!text) {
        return
      }
      event.preventDefault()
      const matrix = parseTsv(text)
      matrix.forEach((cells, rowOffset) => {
        const targetRowIdx = anchor.rowIdx + rowOffset
        const targetRow = displayedRows[targetRowIdx]
        if (!targetRow) {
          return
        }
        cells.forEach((value, colOffset) => {
          const targetColIdx = anchor.colIdx + colOffset
          const targetColumn = columns[targetColIdx]
          if (!targetColumn || !targetColumn.editable) {
            return
          }
          onCellPaste(targetRow, targetColIdx, value)
        })
      })
    },
    [rangePasteEnabled, onCellPaste, anchor, displayedRows, columns],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Escape') {
        return
      }
      if (editing) {
        setEditing(null)
      } else {
        clearSelection()
      }
    },
    [editing, clearSelection],
  )

  const showActionColumn = Boolean(actionColumn)
  const totalColSpan = columns.length + (showActionColumn ? 1 : 0)

  const virtualEnabled = features?.virtualization ?? false
  const virtual = useGridVirtual({
    enabled: virtualEnabled,
    itemCount: displayedRows.length,
    estimatedRowHeight: ESTIMATED_ROW_HEIGHT,
    getScrollElement: () => containerRef.current,
  })

  // 가상화 시 off-screen 행은 DOM 에 없어 cell pointerEnter 가 안 뜬다. drag 중 컨테이너
  // pointer Y → contentOffset → getRowIndexForOffset 로 rowIdx 직접 계산 + edge auto-scroll.
  // getRowIndexForOffset 은 매 렌더 새 함수라 ref 로 받아 effect 재실행을 피한다.
  const getRowIndexForOffsetRef = useRef(virtual.getRowIndexForOffset)
  useEffect(() => {
    getRowIndexForOffsetRef.current = virtual.getRowIndexForOffset
  })

  useEffect(() => {
    if (!virtualEnabled || !isSelecting) {
      return
    }
    const container = containerRef.current
    if (!container) {
      return
    }

    let velocity = 0
    let pointerX = 0
    let pointerY = 0
    let rafId = 0

    const applySelectionAtPointer = () => {
      const target = document.elementFromPoint(pointerX, pointerY)
      // 포인터 아래 실제 셀이 있으면 그 data-row-idx 를 신뢰(estimate 오차 회피). 없을 때만
      // (spacer / 행 아래 빈 영역) pointer-Y → contentOffset 매핑으로 fallback.
      const cell = target?.closest('[data-row-idx]')
      let rowIdx: number | null
      if (cell) {
        rowIdx = Number(cell.getAttribute('data-row-idx'))
      } else {
        const rect = container.getBoundingClientRect()
        rowIdx = getRowIndexForOffsetRef.current(container.scrollTop + (pointerY - rect.top))
      }
      if (rowIdx === null) {
        return
      }
      const colAttr = target?.closest('[data-col-idx]')?.getAttribute('data-col-idx')
      const colIdx = colAttr !== null && colAttr !== undefined ? Number(colAttr) : lastColIdxRef.current
      if (colIdx === null) {
        return
      }
      lastColIdxRef.current = colIdx
      extendSelection({ rowIdx, colIdx })
    }

    const handleMove = (event: globalThis.PointerEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      const rect = container.getBoundingClientRect()
      if (event.clientY < rect.top + AUTO_SCROLL_EDGE) {
        velocity = -AUTO_SCROLL_STEP
      } else if (event.clientY > rect.bottom - AUTO_SCROLL_EDGE) {
        velocity = AUTO_SCROLL_STEP
      } else {
        velocity = 0
      }
      applySelectionAtPointer()
    }

    const tick = () => {
      if (velocity !== 0) {
        container.scrollBy({ top: velocity })
        applySelectionAtPointer()
      }
      rafId = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', handleMove)
    rafId = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      cancelAnimationFrame(rafId)
    }
  }, [virtualEnabled, isSelecting, extendSelection])

  const renderRow = (row: TRow, rowIdx: number): ReactNode => {
    const rowChildren = (
      <>
        {columns.map((column, colIdx) => {
          const isAnchor = isAnchorCell(rowIdx, colIdx)
          const inRange = isCellInRange(rowIdx, colIdx)
          const isEditing = editing?.rowIdx === rowIdx && editing.colIdx === colIdx
          const helpers = {
            isEditing,
            beginEdit: () => beginEdit(rowIdx, colIdx),
            endEdit,
          }
          const cellText = column.accessor(row) || '—'
          const cellContent = column.renderCell
            ? column.renderCell(row, rowIdx, colIdx, helpers)
            : cellText
          // maxWidth 지정 + renderCell 없는 텍스트 셀은 nowrap 이라 박스를 넘쳐 옆 컬럼과
          // 겹친다 → 폭 안에서 ellipsis 로 잘라낸다 (full text 는 title 로 노출).
          const isTruncatable = column.maxWidth !== undefined && !column.renderCell
          const handleCellDoubleClick = column.editable
            ? () => beginEdit(rowIdx, colIdx)
            : undefined
          return (
            <TableCell
              key={`${column.key}-${colIdx}`}
              className={cn(
                'whitespace-nowrap p-1',
                column.sticky
                  ? 'sticky left-0 z-20 bg-card shadow-[4px_0_8px_-8px_rgba(20,46,36,0.6)]'
                  : null,
              )}
              style={{
                ...columnSizeStyle(column),
                ...(stickyCellStyle(column.sticky) ?? {}),
              }}
              data-row-idx={rowIdx}
              data-col-idx={colIdx}
            >
              <div
                onPointerDown={handleCellPointerDown(rowIdx, colIdx)}
                onPointerEnter={handleCellPointerEnter(rowIdx, colIdx)}
                onDoubleClick={handleCellDoubleClick}
                className={cn(
                  'flex min-h-8 select-none items-center rounded-md border px-2 py-1 transition-colors',
                  isTruncatable ? 'min-w-0' : null,
                  isAnchor
                    ? 'border-foreground/30 bg-foreground/10'
                    : inRange
                      ? 'border-foreground/20 bg-foreground/[0.05]'
                      : 'border-transparent bg-transparent hover:bg-muted',
                )}
              >
                {isTruncatable ? (
                  <span className="block min-w-0 truncate" title={cellText}>
                    {cellContent}
                  </span>
                ) : (
                  cellContent
                )}
              </div>
            </TableCell>
          )
        })}
        {showActionColumn && actionColumn ? (
          <TableCell className="whitespace-nowrap">{actionColumn.render(row, rowIdx)}</TableCell>
        ) : null}
      </>
    )
    const key = rowKey(row, rowIdx)
    return (
      <Fragment key={key}>
        {wrapRow ? wrapRow(row, rowIdx, rowChildren) : <TableRow>{rowChildren}</TableRow>}
      </Fragment>
    )
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      className={cn(
        'min-h-0 min-w-0 flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring',
        containerClassName,
      )}
      data-testid={testId}
    >
      <Table className={cn('min-w-max table-auto', tableClassName)}>
        <TableHeader>
          <TableRow className="bg-muted">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                data-col-key={column.key}
                className={cn(
                  'relative whitespace-nowrap',
                  column.sticky
                    ? 'sticky left-0 z-30 bg-muted shadow-[4px_0_8px_-8px_rgba(20,46,36,0.6)]'
                    : null,
                )}
                style={{
                  ...columnSizeStyle(column),
                  ...(stickyHeadStyle(column.sticky) ?? {}),
                }}
              >
                {sortEnabled && column.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleColumn(column.key)}
                    className="flex items-center gap-1 font-medium outline-none hover:text-foreground focus-visible:text-foreground"
                  >
                    {column.header}
                    <span aria-hidden className="text-[10px] text-muted-foreground">
                      {sort.columnKey === column.key
                        ? sort.direction === 'asc'
                          ? '▲'
                          : sort.direction === 'desc'
                            ? '▼'
                            : ''
                        : ''}
                    </span>
                  </button>
                ) : (
                  column.header
                )}
                {resizeEnabled && column.resizable ? (
                  <span
                    data-resize-handle={column.key}
                    onPointerDown={handleResizePointerDown(column.key)}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-foreground/20"
                  />
                ) : null}
              </TableHead>
            ))}
            {showActionColumn ? (
              <TableHead
                className={cn('whitespace-nowrap', actionColumn?.headerClassName)}
                style={{ width: actionColumn?.width, minWidth: actionColumn?.width }}
              >
                {actionColumn?.header ?? t('common.table.action')}
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={totalColSpan}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                {emptyState ?? t('common.table.empty')}
              </TableCell>
            </TableRow>
          ) : virtual.enabled ? (
            <>
              {virtual.paddingTop > 0 ? (
                <tr aria-hidden>
                  <td colSpan={totalColSpan} style={{ height: virtual.paddingTop, padding: 0, border: 0 }} />
                </tr>
              ) : null}
              {virtual.virtualRows.map((virtualRow) =>
                renderRow(displayedRows[virtualRow.index], virtualRow.index),
              )}
              {virtual.paddingBottom > 0 ? (
                <tr aria-hidden>
                  <td colSpan={totalColSpan} style={{ height: virtual.paddingBottom, padding: 0, border: 0 }} />
                </tr>
              ) : null}
            </>
          ) : (
            displayedRows.map((row, rowIdx) => renderRow(row, rowIdx))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
