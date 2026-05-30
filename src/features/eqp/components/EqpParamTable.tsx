import { memo, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type {
  ColumnDef,
  SelectableTableActionColumn,
} from '@/shared/components/SelectableTable'
import { useI18n } from '@/i18n/i18n-context'
import type { EqpParamRow } from '../types/eqp.types'

const EQP_PARAM_SKELETON_ROW_COUNT = 8

type EqpParamTableRow = EqpParamRow & { rowId?: string }

interface EqpParamTableProps {
  rows: EqpParamTableRow[]
  isEditMode: boolean
  isLoading: boolean
  onChangeParamName: (rowId: string, nextValue: string) => void
  onChangeValue: (rowId: string, nextValue: string) => void
  onChangeDescription: (rowId: string, nextValue: string) => void
  onAddRow: () => void
  onDeleteRow: (rowId: string) => void
}

/**
 * EQP Parameter 테이블입니다.
 * 설비 정보 테이블과 동일한 스타일을 유지하면서 편집 모드에서는 행 추가/삭제와 인라인 수정을 지원합니다.
 */
export const EqpParamTable = memo(function EqpParamTable({
  rows,
  isEditMode,
  isLoading,
  onChangeParamName,
  onChangeValue,
  onChangeDescription,
  onAddRow,
  onDeleteRow,
}: EqpParamTableProps) {
  const { t } = useI18n()
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const effectiveSelectedRowId =
    selectedRowId ?? (rows[0] ? (rows[0].rowId ?? rows[0].paramName) : null)

  const columns = useMemo<ReadonlyArray<ColumnDef<EqpParamTableRow>>>(
    () => [
      {
        key: 'paramName',
        header: 'Param Name',
        accessor: (row) => row.paramName,
        renderCell: (row) =>
          isEditMode && row.rowId ? (
            <Input
              value={row.paramName}
              onChange={(event) => onChangeParamName(row.rowId as string, event.target.value)}
              className="h-8 rounded-lg border-input"
              placeholder="Param Name"
            />
          ) : (
            <span className="min-w-[240px]">{row.paramName}</span>
          ),
      },
      {
        key: 'paramValue',
        header: 'Param Value',
        accessor: (row) => row.paramValue,
        renderCell: (row) =>
          isEditMode && row.rowId ? (
            <Input
              value={row.paramValue}
              onChange={(event) => onChangeValue(row.rowId as string, event.target.value)}
              className="h-8 rounded-lg border-input"
              placeholder="Param Value"
            />
          ) : (
            row.paramValue || '—'
          ),
      },
      {
        key: 'description',
        header: 'Description',
        accessor: (row) => row.description,
        renderCell: (row) =>
          isEditMode && row.rowId ? (
            <Input
              value={row.description}
              onChange={(event) => onChangeDescription(row.rowId as string, event.target.value)}
              className="h-8 rounded-lg border-input"
              placeholder="Description"
            />
          ) : (
            <span className="min-w-[280px]">{row.description || '—'}</span>
          ),
      },
    ],
    [isEditMode, onChangeParamName, onChangeValue, onChangeDescription],
  )

  const actionColumn = useMemo<SelectableTableActionColumn<EqpParamTableRow> | undefined>(
    () =>
      isEditMode
        ? {
            header: t('eqp.param.action'),
            width: '92px',
            render: (row) =>
              row.rowId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-danger"
                  onClick={() => onDeleteRow(row.rowId as string)}
                  aria-label={`${row.paramName || '새 파라미터'} 행 삭제`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              ) : null,
          }
        : undefined,
    [isEditMode, onDeleteRow, t],
  )

  const emptyMessage = isEditMode ? t('eqp.param.emptyEdit') : t('eqp.param.emptyRead')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {t('eqp.param.title')}
        </h2>

        {isEditMode ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
            onClick={onAddRow}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('eqp.param.addRow')}
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead>Param Name</TableHead>
                <TableHead>Param Value</TableHead>
                <TableHead>Description</TableHead>
                {isEditMode ? <TableHead className="w-[92px]">{t('eqp.param.action')}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: EQP_PARAM_SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                <TableRow
                  key={`eqp-param-skeleton-${rowIndex}`}
                  data-testid="eqp-param-skeleton"
                >
                  {Array.from({ length: isEditMode ? 4 : 3 }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <SelectableTable<EqpParamTableRow>
            testId="selectable-table-eqp-param"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.rowId ?? row.paramName}
            actionColumn={actionColumn}
            tableClassName="min-w-[960px]"
            wrapRow={(row, _rowIdx, children) => {
              const rowId = row.rowId ?? row.paramName
              return (
                <TableRow
                  data-state={effectiveSelectedRowId === rowId ? 'selected' : undefined}
                  onClick={() => setSelectedRowId(rowId)}
                  onContextMenu={() => setSelectedRowId(rowId)}
                >
                  {children}
                </TableRow>
              )
            }}
          />
        )}
      </div>
    </div>
  )
})
