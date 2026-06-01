import { useState, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SelectableTable, type ColumnDef } from '@/shared/components/SelectableTable'

export type EqpParamDiffStatus = 'added' | 'changed' | 'deleted'

export interface EqpParamDiffRow {
  status: EqpParamDiffStatus
  paramName: string
  parentValue: string
  branchValue: string
  parentDescription: string
  branchDescription: string
}

interface CheckInModalProps {
  open: boolean
  isPending: boolean
  isDiffLoading: boolean
  diffRows: EqpParamDiffRow[]
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onSave: (description: string) => void
  onCancel: () => void
}

/**
 * Check In 동작을 확인하는 모달입니다.
 * 버전은 서버가 자동 생성하고, 사용자는 변경 설명만 입력합니다.
 */
export function CheckInModal({
  open,
  isPending,
  isDiffLoading,
  diffRows,
  errorMessage,
  onOpenChange,
  onSave,
  onCancel,
}: CheckInModalProps) {
  const [description, setDescription] = useState('')
  const hasDiff = diffRows.length > 0

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) {
      // 모달이 닫힐 때 입력값 초기화
      if (!nextOpen) {
        setDescription('')
      }
      onOpenChange(nextOpen)
    }
  }

  const handleSave = () => {
    onSave(description.trim())
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="z-[60] max-w-4xl rounded-2xl" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>Check In</DialogTitle>
          <DialogDescription>
            버전은 서버가 `YY.MM.DD.0000` 형식으로 자동 생성합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <section className="mb-4 overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center justify-between bg-muted px-4 py-2.5">
              <span className="text-sm font-semibold text-foreground">Diff Preview</span>
              <span className="text-xs text-muted-foreground">
                Add {diffRows.filter((row) => row.status === 'added').length} / Change{' '}
                {diffRows.filter((row) => row.status === 'changed').length} / Delete{' '}
                {diffRows.filter((row) => row.status === 'deleted').length}
              </span>
            </div>

            {isDiffLoading ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-24">구분</TableHead>
                      <TableHead className="w-48">Param Name</TableHead>
                      <TableHead>Param Value</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, rowIndex) => (
                      <TableRow key={`checkin-diff-skeleton-${rowIndex}`} data-testid="checkin-diff-skeleton">
                        {Array.from({ length: 4 }).map((_, cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : !hasDiff ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                이전 버전과 비교하여 변경된 설비 파라미터가 없습니다.
              </p>
            ) : (
              <SelectableTable<EqpParamDiffRow>
                testId="selectable-table-check-in-diff"
                columns={EQP_PARAM_DIFF_COLUMNS}
                rows={diffRows}
                rowKey={(row) => `${row.status}-${row.paramName}`}
                features={{ rangeCopy: true }}
                tableClassName="min-w-[760px]"
                wrapRow={renderDiffRow}
              />
            )}
          </section>

          <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground">
              Version
            </label>
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              저장 시 자동 생성됩니다. 예: 25.03.12.0000
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="checkin-description" className="text-xs font-semibold text-foreground">
              Description
            </label>
            <textarea
              id="checkin-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="변경 내용 설명 (선택)"
              disabled={isPending}
              rows={3}
              className="rounded-lg border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted resize-none"
            />
          </div>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full border-border px-4 text-xs font-semibold"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={handleSave}
            disabled={isPending || isDiffLoading}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 셀 영역 TSV 복사용 단일 문자열. deleted 는 parent 값, 그 외(added/changed)는 branch 값을
 * 노출합니다 (ModelCheckInDiffModal 의 branch 우선 정책과 동일). 화면은 renderCell 의
 * DiffValuePair 로 양값을 보여주되, accessor 는 한 셀당 한 값으로 단순화합니다.
 */
const resolveDiffValue = (
  status: EqpParamDiffStatus,
  parentValue: string,
  branchValue: string,
): string => (status === 'deleted' ? parentValue : branchValue)

const EQP_PARAM_DIFF_COLUMNS: ColumnDef<EqpParamDiffRow>[] = [
  {
    key: 'status',
    header: '구분',
    width: '6rem',
    accessor: (row) => resolveDiffTone(row.status).label,
    renderCell: (row) => {
      const tone = resolveDiffTone(row.status)
      return (
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${tone.badgeClassName}`}>
          {tone.label}
        </span>
      )
    },
  },
  {
    key: 'paramName',
    header: 'Param Name',
    width: '12rem',
    accessor: (row) => row.paramName,
    renderCell: (row) => (
      <span
        className={
          row.status === 'deleted'
            ? 'text-xs text-muted-foreground line-through'
            : 'text-xs text-foreground'
        }
      >
        {row.paramName || '-'}
      </span>
    ),
  },
  {
    key: 'paramValue',
    header: 'Param Value',
    accessor: (row) => resolveDiffValue(row.status, row.parentValue, row.branchValue),
    renderCell: (row) => (
      <span className="text-xs">
        <DiffValuePair
          status={row.status}
          parentValue={row.parentValue}
          branchValue={row.branchValue}
        />
      </span>
    ),
  },
  {
    key: 'description',
    header: 'Description',
    accessor: (row) => resolveDiffValue(row.status, row.parentDescription, row.branchDescription),
    renderCell: (row) => (
      <span className="text-xs">
        <DiffValuePair
          status={row.status}
          parentValue={row.parentDescription}
          branchValue={row.branchDescription}
        />
      </span>
    ),
  },
]

const renderDiffRow = (row: EqpParamDiffRow, _rowIdx: number, children: ReactNode): ReactNode => {
  const tone = resolveDiffTone(row.status)
  return (
    <TableRow
      data-testid={`check-in-diff-row-${row.status}-${row.paramName}`}
      className={`${tone.rowClassName} ${tone.hoverClassName}`}
    >
      {children}
    </TableRow>
  )
}

function DiffValuePair({
  status,
  parentValue,
  branchValue,
}: {
  status: EqpParamDiffStatus
  parentValue: string
  branchValue: string
}) {
  if (status === 'added') {
    return <DiffCellValue value={branchValue} className="text-foreground" />
  }

  if (status === 'deleted') {
    return <DiffCellValue value={parentValue} className="text-muted-foreground line-through" />
  }

  if (parentValue === branchValue) {
    return <DiffCellValue value={branchValue} className="text-foreground" />
  }

  return (
    <div className="space-y-1">
      <DiffCellValue value={parentValue} className="text-muted-foreground line-through" />
      <DiffCellValue value={branchValue} className="font-medium text-success" />
    </div>
  )
}

function DiffCellValue({ value, className }: { value: string; className: string }) {
  if (!value) {
    return <span className={className}>-</span>
  }

  const maxLength = 100
  if (value.length <= maxLength) {
    return <span className={className}>{value}</span>
  }

  return (
    <span className={className} title={value}>
      {value.slice(0, maxLength)}
      <span className="text-muted-foreground">...</span>
    </span>
  )
}

function resolveDiffTone(status: EqpParamDiffStatus) {
  if (status === 'added') {
    return {
      label: 'Add',
      rowClassName: 'bg-success/5',
      hoverClassName: 'hover:bg-success/5',
      badgeClassName: 'bg-success/15 text-success',
    }
  }

  if (status === 'changed') {
    return {
      label: 'Change',
      rowClassName: 'bg-warning/5',
      hoverClassName: 'hover:bg-warning/5',
      badgeClassName: 'bg-warning/20 text-warning-foreground',
    }
  }

  return {
    label: 'Delete',
    rowClassName: 'bg-danger/5',
    hoverClassName: 'hover:bg-danger/5',
    badgeClassName: 'bg-danger/15 text-danger',
  }
}
