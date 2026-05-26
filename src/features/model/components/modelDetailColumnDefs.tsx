/* eslint-disable react-refresh/only-export-components --
 * 이 파일은 React 컴포넌트가 아니라 ColumnDef factory + 모듈 상수 (DCOP_COLLECTION_RULE_OPTIONS)
 * 만 export. JSX 사용을 위해 확장자만 .tsx 이며 fast-refresh 대상이 아니므로 룰 예외 처리.
 */
import { type ChangeEvent } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import type { ModelDetailRow } from '../types/model.types'

/**
 * SPEC `selectable-table-rollout` R3 — ModelDetailPanel 의 9 개 detail 노드를 한
 * `SelectableTable` 호출로 통합하기 위한 노드별 ColumnDef factory 모음입니다.
 * 옛 `<Table>` 분기 (ModelDetailPanel.tsx L1047-1340) 의 셀별 분기 — modal trigger /
 * select dropdown / 일반 Input — 을 노드 단위로 분리하여 `renderCell` 에 옮긴 형태입니다.
 */

/** workflow 의 Filter / Data Index 컬럼을 식별합니다 (modal trigger 대상). */
const FLOW_MODAL_EDITABLE_COLUMNS = new Set(['filter', 'data index'])

const isFlowModalEditableColumnName = (columnName: string): boolean =>
  FLOW_MODAL_EDITABLE_COLUMNS.has(columnName.trim().toLowerCase())

const isFilterColumnName = (columnName: string): boolean =>
  columnName.trim().toLowerCase() === 'filter'

const isDataIndexColumnName = (columnName: string): boolean =>
  columnName.trim().toLowerCase() === 'data index'

const isMessageNameColumnName = (columnName: string): boolean =>
  columnName.trim().toLowerCase() === 'message name'

const isEventIdColumnName = (columnName: string): boolean =>
  columnName.trim().toLowerCase() === 'eventid'

const isDcopCollectionRuleColumnName = (columnName: string): boolean =>
  columnName.trim() === 'Collection Rule'

/** dcop-itemes 의 Collection Rule 선택 옵션 (기본값: LAST) */
export const DCOP_COLLECTION_RULE_OPTIONS = ['LAST', 'FIRST', 'AVERAGE', 'MIN', 'MAX'] as const

/**
 * workflow 첫 번째 컬럼 (Flow Name) 의 중복 여부를 판단합니다.
 * 자기 자신 row 는 제외하고 다른 row 의 첫 컬럼과만 비교합니다.
 */
const hasDuplicateFlowName = (
  value: string,
  rowId: string,
  allRows: readonly ModelDetailRow[],
): boolean => {
  const normalized = value.trim()
  if (!normalized) {
    return false
  }
  return allRows.some(
    (other) => other.id !== rowId && (other.values[0] ?? '').trim() === normalized,
  )
}

/**
 * workflow 의 Filter / Data Index 컬럼이 셀에 표시할 preview 문자열을 결정합니다.
 * BE 응답이 미리 계산해 둔 `previewValues` 가 있으면 그것을 우선 사용하고, 없을 때만
 * `summarize*` 헬퍼로 raw JSON 을 요약합니다.
 */
const resolveFlowPreviewValue = (
  row: ModelDetailRow,
  columnIndex: number,
  columnName: string,
  summarizeFlowFilterValue: (raw: string) => string,
  summarizeActionDataIndexValue: (raw: string) => string,
): string => {
  const storedPreview = row.previewValues[columnIndex]?.trim()
  if (storedPreview) {
    return storedPreview
  }

  const rawValue = row.values[columnIndex] ?? ''
  if (isFilterColumnName(columnName)) {
    return summarizeFlowFilterValue(rawValue)
  }

  if (isDataIndexColumnName(columnName)) {
    return summarizeActionDataIndexValue(rawValue)
  }

  return rawValue
}

interface VisibleColumn {
  columnName: string
  columnIndex: number
}

interface ModelParameterColumnsDeps {
  visibleColumns: readonly VisibleColumn[]
  detailColumnWidths: readonly string[]
  isReadOnly: boolean
  onChangeDetailValue: (rowId: string, columnIndex: number, nextValue: string) => void
}

/**
 * model-parameter 노드의 ColumnDef factory — PoC L965-1006 패턴 그대로.
 * Excel UX: 평소엔 span(read view), 더블클릭 또는 anchor 후 Enter 시 Input 으로 전환.
 */
export const createModelParameterColumns = ({
  visibleColumns,
  detailColumnWidths,
  isReadOnly,
  onChangeDetailValue,
}: ModelParameterColumnsDeps): ColumnDef<ModelDetailRow>[] =>
  visibleColumns.map(({ columnName, columnIndex }, visibleIndex) => ({
    key: `${columnName}-${visibleIndex}`,
    header: columnName,
    accessor: (row) => row.values[columnIndex] ?? '',
    editable: !isReadOnly,
    sticky: visibleIndex === 0,
    width: detailColumnWidths[columnIndex],
    renderCell: (row, _rowIdx, _colIdx, { isEditing, endEdit }) => {
      const rawValue = row.values[columnIndex] ?? ''
      if (isReadOnly || !isEditing) {
        return (
          <span
            className={cn(
              'min-w-0 truncate text-sm text-[#22322B]',
              rawValue ? null : 'text-[#8A8A8A]',
            )}
            title={rawValue}
          >
            {rawValue || '—'}
          </span>
        )
      }
      return (
        <Input
          autoFocus
          value={rawValue}
          onChange={(event) => onChangeDetailValue(row.id, columnIndex, event.target.value)}
          onBlur={endEdit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              endEdit()
            }
          }}
          className="h-7 w-full min-w-0"
        />
      )
    },
  }))

interface WorkflowColumnsDeps {
  visibleColumns: readonly VisibleColumn[]
  detailColumnWidths: readonly string[]
  isReadOnly: boolean
  modalPreviewWidth: string
  allRows: readonly ModelDetailRow[]
  messageOptions: readonly { value: string; label: string }[]
  eventIdOptions: readonly string[]
  onChangeDetailValue: (rowId: string, columnIndex: number, nextValue: string) => void
  onOpenFlowTextEditor: (
    row: ModelDetailRow,
    rowIndex: number,
    columnIndex: number,
  ) => void
  summarizeFlowFilterValue: (raw: string) => string
  summarizeActionDataIndexValue: (raw: string) => string
}

/**
 * workflow 노드의 ColumnDef factory.
 *
 * SPEC R3 W2 결정 (옵션 C — always-edit Input):
 * - Flow Name (visibleIndex === 0) 은 `isEditing` 무시하고 항상 `<Input>` 렌더.
 * - 다른 행과 중복 시 빨간 border + title.
 *
 * SPEC R3 W5 결정 (옵션 B — types.ts maxWidth):
 * - Filter / Data Index 컬럼은 `maxWidth = modalPreviewWidth` 로 폭 고정 (preview 짤림 보장).
 * - 셀 본체는 modal trigger (read-only summary + MoreHorizontal 버튼) — `editable: false`
 *   로 두어 onDoubleClick = `beginEdit` 가 modal open 과 충돌하지 않도록 한다.
 */
export const createWorkflowColumns = ({
  visibleColumns,
  detailColumnWidths,
  isReadOnly,
  modalPreviewWidth,
  allRows,
  messageOptions,
  eventIdOptions,
  onChangeDetailValue,
  onOpenFlowTextEditor,
  summarizeFlowFilterValue,
  summarizeActionDataIndexValue,
}: WorkflowColumnsDeps): ColumnDef<ModelDetailRow>[] =>
  visibleColumns.map(({ columnName, columnIndex }, visibleIndex) => {
    const isModalEditable = isFlowModalEditableColumnName(columnName)
    const isFlowNameColumn = visibleIndex === 0
    const isMessageName = isMessageNameColumnName(columnName)
    const isEventId = isEventIdColumnName(columnName)

    return {
      key: `${columnName}-${visibleIndex}`,
      header: columnName,
      accessor: (row) => row.values[columnIndex] ?? '',
      editable: !isReadOnly && !isModalEditable,
      sticky: visibleIndex === 0,
      width: detailColumnWidths[columnIndex],
      maxWidth: isModalEditable ? modalPreviewWidth : undefined,
      renderCell: (row, rowIdx, _colIdx, { isEditing, endEdit }) => {
        const rawValue = row.values[columnIndex] ?? ''

        // Filter / Data Index — modal trigger (always-read, MoreHorizontal 버튼)
        if (isModalEditable) {
          const previewValue = resolveFlowPreviewValue(
            row,
            columnIndex,
            columnName,
            summarizeFlowFilterValue,
            summarizeActionDataIndexValue,
          )
          return (
            <div
              className="group flex min-h-8 w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-md border border-[#DCE5E0] bg-white px-2 py-1.5"
              onDoubleClick={() => onOpenFlowTextEditor(row, rowIdx, columnIndex)}
            >
              <span
                className={cn(
                  'min-w-0 flex-1 text-sm text-[#22322B]',
                  previewValue ? 'truncate' : 'text-[#8A8A8A]',
                )}
                title={previewValue || rawValue}
              >
                {previewValue || '—'}
              </span>
              <button
                type="button"
                onClick={() => onOpenFlowTextEditor(row, rowIdx, columnIndex)}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-[#5B6962] transition hover:border-[#DCE5E0] hover:bg-[#F3F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                aria-label={`${row.values[0] ?? 'flow'} ${columnName} 편집`}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </div>
          )
        }

        // 읽기 전용 — span
        if (isReadOnly) {
          return (
            <span
              className={cn(
                'inline-block whitespace-nowrap text-sm text-[#22322B]',
                rawValue ? null : 'text-[#8A8A8A]',
              )}
              title={rawValue}
            >
              {rawValue || '—'}
            </span>
          )
        }

        // Flow Name — always-edit Input (W2-C). 중복 시 빨간 border.
        if (isFlowNameColumn) {
          const isDuplicate = hasDuplicateFlowName(rawValue, row.id, allRows)
          return (
            <Input
              value={rawValue}
              onChange={(event) => onChangeDetailValue(row.id, columnIndex, event.target.value)}
              className={cn(
                'h-8 w-full min-w-0',
                isDuplicate ? 'border-[#C5534B] focus-visible:ring-[#C5534B]/30' : null,
              )}
              title={isDuplicate ? '다른 행에 동일한 Flow Name이 있습니다.' : undefined}
            />
          )
        }

        // Message Name — secs-message / socket-message + MES dropdown
        if (isMessageName) {
          return (
            <select
              value={rawValue}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                onChangeDetailValue(row.id, columnIndex, event.target.value)
              }
              className="h-8 w-full min-w-0 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
            >
              <option value="">—</option>
              {rawValue && !messageOptions.some((option) => option.value === rawValue) ? (
                <option value={rawValue}>{rawValue}</option>
              ) : null}
              {messageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )
        }

        // EventId — eventides dropdown (SECS 모델 전용; SOCKET 시 options 빈 배열)
        if (isEventId) {
          return (
            <select
              value={rawValue}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                onChangeDetailValue(row.id, columnIndex, event.target.value)
              }
              className="h-8 w-full min-w-0 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
            >
              <option value="">—</option>
              {rawValue && !eventIdOptions.includes(rawValue) ? (
                <option value={rawValue}>{rawValue}</option>
              ) : null}
              {eventIdOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          )
        }

        // 그 외 — 옛 Excel-style read view / 더블클릭 Input (PoC 패턴)
        if (!isEditing) {
          return (
            <span
              className={cn(
                'min-w-0 truncate text-sm text-[#22322B]',
                rawValue ? null : 'text-[#8A8A8A]',
              )}
              title={rawValue}
            >
              {rawValue || '—'}
            </span>
          )
        }
        return (
          <Input
            autoFocus
            value={rawValue}
            onChange={(event) => onChangeDetailValue(row.id, columnIndex, event.target.value)}
            onBlur={endEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                endEdit()
              }
            }}
            className="h-7 w-full min-w-0"
          />
        )
      },
    }
  })

interface DcopItemsColumnsDeps {
  visibleColumns: readonly VisibleColumn[]
  detailColumnWidths: readonly string[]
  isReadOnly: boolean
  eventIdOptions: readonly string[]
  onChangeDetailValue: (rowId: string, columnIndex: number, nextValue: string) => void
}

/**
 * dcop-itemes 노드의 ColumnDef factory.
 * - EventId 컬럼: SECS eventides dropdown
 * - Collection Rule 컬럼: LAST / FIRST / AVERAGE / MIN / MAX (기본값 LAST)
 * - 그 외: PoC Excel UX (span → 더블클릭 Input)
 */
export const createDcopItemsColumns = ({
  visibleColumns,
  detailColumnWidths,
  isReadOnly,
  eventIdOptions,
  onChangeDetailValue,
}: DcopItemsColumnsDeps): ColumnDef<ModelDetailRow>[] =>
  visibleColumns.map(({ columnName, columnIndex }, visibleIndex) => {
    const isEventId = isEventIdColumnName(columnName)
    const isCollectionRule = isDcopCollectionRuleColumnName(columnName)

    return {
      key: `${columnName}-${visibleIndex}`,
      header: columnName,
      accessor: (row) => row.values[columnIndex] ?? '',
      editable: !isReadOnly,
      sticky: visibleIndex === 0,
      width: detailColumnWidths[columnIndex],
      renderCell: (row, _rowIdx, _colIdx, { isEditing, endEdit }) => {
        const rawValue = row.values[columnIndex] ?? ''

        if (isReadOnly) {
          return (
            <span
              className={cn(
                'inline-block whitespace-nowrap text-sm text-[#22322B]',
                rawValue ? null : 'text-[#8A8A8A]',
              )}
              title={rawValue}
            >
              {rawValue || '—'}
            </span>
          )
        }

        if (isEventId) {
          return (
            <select
              value={rawValue}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                onChangeDetailValue(row.id, columnIndex, event.target.value)
              }
              className="h-8 w-full min-w-0 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
            >
              <option value="">—</option>
              {rawValue && !eventIdOptions.includes(rawValue) ? (
                <option value={rawValue}>{rawValue}</option>
              ) : null}
              {eventIdOptions.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          )
        }

        if (isCollectionRule) {
          return (
            <select
              value={rawValue || 'LAST'}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                onChangeDetailValue(row.id, columnIndex, event.target.value)
              }
              className="h-8 w-full min-w-0 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
            >
              {DCOP_COLLECTION_RULE_OPTIONS.map((rule) => (
                <option key={rule} value={rule}>
                  {rule}
                </option>
              ))}
            </select>
          )
        }

        if (!isEditing) {
          return (
            <span
              className={cn(
                'min-w-0 truncate text-sm text-[#22322B]',
                rawValue ? null : 'text-[#8A8A8A]',
              )}
              title={rawValue}
            >
              {rawValue || '—'}
            </span>
          )
        }
        return (
          <Input
            autoFocus
            value={rawValue}
            onChange={(event) => onChangeDetailValue(row.id, columnIndex, event.target.value)}
            onBlur={endEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                endEdit()
              }
            }}
            className="h-7 w-full min-w-0"
          />
        )
      },
    }
  })

interface GenericInputColumnsDeps {
  visibleColumns: readonly VisibleColumn[]
  detailColumnWidths: readonly string[]
  isReadOnly: boolean
  onChangeDetailValue: (rowId: string, columnIndex: number, nextValue: string) => void
}

/**
 * secs-message / mes-message / socket-message / variableides / reportides / eventides
 * 6 노드 공통 — 모든 컬럼이 단순 Input. PoC Excel UX (span 평소, 더블클릭/Enter 시 Input).
 */
export const createGenericInputColumns = ({
  visibleColumns,
  detailColumnWidths,
  isReadOnly,
  onChangeDetailValue,
}: GenericInputColumnsDeps): ColumnDef<ModelDetailRow>[] =>
  visibleColumns.map(({ columnName, columnIndex }, visibleIndex) => ({
    key: `${columnName}-${visibleIndex}`,
    header: columnName,
    accessor: (row) => row.values[columnIndex] ?? '',
    editable: !isReadOnly,
    sticky: visibleIndex === 0,
    width: detailColumnWidths[columnIndex],
    renderCell: (row, _rowIdx, _colIdx, { isEditing, endEdit }) => {
      const rawValue = row.values[columnIndex] ?? ''
      if (isReadOnly || !isEditing) {
        return (
          <span
            className={cn(
              'min-w-0 truncate text-sm text-[#22322B]',
              rawValue ? null : 'text-[#8A8A8A]',
            )}
            title={rawValue}
          >
            {rawValue || '—'}
          </span>
        )
      }
      return (
        <Input
          autoFocus
          value={rawValue}
          onChange={(event) => onChangeDetailValue(row.id, columnIndex, event.target.value)}
          onBlur={endEdit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              endEdit()
            }
          }}
          className="h-7 w-full min-w-0"
        />
      )
    },
  }))
