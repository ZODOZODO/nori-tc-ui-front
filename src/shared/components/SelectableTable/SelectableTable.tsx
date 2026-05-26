import {
  useCallback,
  useEffect,
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
import { useGridRangeSelection } from '@/shared/hooks/useGridRangeSelection'
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

/**
 * shadcn `<Table>` 기반 제네릭 셀 영역 선택 / Ctrl+C TSV / Ctrl+V paste 테이블.
 *
 * 디자인 토큰 (헤더 #F6F9F7, anchor #EAF5EE, range #1C7F59/10) 은 PoC
 * `SelectableModelDetailTable` 의 토큰을 그대로 옮겨 ModelDetailPanel 의 기존 셀과
 * 시각 일관성을 유지합니다. 셀 내부 콘텐츠는 `column.renderCell` 로 위임하여
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
}: SelectableTableProps<TRow>) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const {
    range,
    anchor,
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

  const rangeCopyEnabled = features?.rangeCopy ?? true
  const rangePasteEnabled =
    features?.rangePaste ?? Boolean(onCellPaste && columns.some((column) => column.editable))

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
      beginSelection({ rowIdx, colIdx })
    },
    [beginSelection],
  )

  const handleCellPointerEnter = useCallback(
    (rowIdx: number, colIdx: number) => () => {
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
      const tsv = buildTsv(rows, columns, range)
      event.clipboardData?.setData('text/plain', tsv)
      event.preventDefault()
    },
    [rangeCopyEnabled, range, rows, columns],
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
        const targetRow = rows[targetRowIdx]
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
    [rangePasteEnabled, onCellPaste, anchor, rows, columns],
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

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      className={cn(
        'min-h-0 min-w-0 flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
        containerClassName,
      )}
      data-testid={testId}
    >
      <Table className={cn('min-w-max table-auto', tableClassName)}>
        <TableHeader>
          <TableRow className="bg-[#F6F9F7]">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  'whitespace-nowrap',
                  column.sticky
                    ? 'sticky left-0 z-30 bg-[#F6F9F7] shadow-[4px_0_8px_-8px_rgba(20,46,36,0.6)]'
                    : null,
                )}
                style={{
                  width: column.width,
                  minWidth: column.width,
                  maxWidth: column.maxWidth,
                  ...(stickyHeadStyle(column.sticky) ?? {}),
                }}
              >
                {column.header}
              </TableHead>
            ))}
            {showActionColumn ? (
              <TableHead
                className="whitespace-nowrap"
                style={{ width: actionColumn?.width, minWidth: actionColumn?.width }}
              >
                {actionColumn?.header ?? '작업'}
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (showActionColumn ? 1 : 0)}
                className="py-10 text-center text-sm text-[#647169]"
              >
                {emptyState ?? '표시할 데이터가 없습니다.'}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIdx) => (
              <TableRow key={rowKey(row, rowIdx)}>
                {columns.map((column, colIdx) => {
                  const isAnchor = isAnchorCell(rowIdx, colIdx)
                  const inRange = isCellInRange(rowIdx, colIdx)
                  const isEditing =
                    editing?.rowIdx === rowIdx && editing.colIdx === colIdx
                  const helpers = {
                    isEditing,
                    beginEdit: () => beginEdit(rowIdx, colIdx),
                    endEdit,
                  }
                  const cellContent = column.renderCell
                    ? column.renderCell(row, rowIdx, colIdx, helpers)
                    : (column.accessor(row) || '—')
                  const handleCellDoubleClick = column.editable
                    ? () => beginEdit(rowIdx, colIdx)
                    : undefined
                  return (
                    <TableCell
                      key={`${column.key}-${colIdx}`}
                      className={cn(
                        'whitespace-nowrap p-1',
                        column.sticky
                          ? 'sticky left-0 z-20 bg-white shadow-[4px_0_8px_-8px_rgba(20,46,36,0.6)]'
                          : null,
                      )}
                      style={{
                        width: column.width,
                        minWidth: column.width,
                        maxWidth: column.maxWidth,
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
                          isAnchor
                            ? 'border-[#1C7F59] bg-[#EAF5EE]'
                            : inRange
                              ? 'border-[#1C7F59]/30 bg-[#1C7F59]/10'
                              : 'border-transparent bg-transparent hover:bg-[#F3F7F5]',
                        )}
                      >
                        {cellContent}
                      </div>
                    </TableCell>
                  )
                })}
                {showActionColumn && actionColumn ? (
                  <TableCell className="whitespace-nowrap">
                    {actionColumn.render(row, rowIdx)}
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
