import { useState } from 'react'
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
          <section className="mb-4 overflow-hidden rounded-2xl border border-[#E4EAE6]">
            <div className="flex items-center justify-between bg-[#F6F9F7] px-4 py-2.5">
              <span className="text-sm font-semibold text-[#1E3D33]">Diff Preview</span>
              <span className="text-xs text-[#647169]">
                Add {diffRows.filter((row) => row.status === 'added').length} / Change{' '}
                {diffRows.filter((row) => row.status === 'changed').length} / Delete{' '}
                {diffRows.filter((row) => row.status === 'deleted').length}
              </span>
            </div>

            {isDiffLoading ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="bg-[#FAFCFB] hover:bg-[#FAFCFB]">
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
              <p className="py-10 text-center text-sm text-[#647169]">
                이전 버전과 비교하여 변경된 설비 파라미터가 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="bg-[#FAFCFB] hover:bg-[#FAFCFB]">
                      <TableHead className="w-24">구분</TableHead>
                      <TableHead className="w-48">Param Name</TableHead>
                      <TableHead>Param Value</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diffRows.map((row) => (
                      <EqpParamDiffTableRow key={`${row.status}-${row.paramName}`} row={row} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#1E3D33]">
              Version
            </label>
            <div className="rounded-lg border border-[#D7E1DB] bg-[#F5F8F6] px-3 py-2 text-xs text-[#51605A]">
              저장 시 자동 생성됩니다. 예: 25.03.12.0000
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="checkin-description" className="text-xs font-semibold text-[#1E3D33]">
              Description
            </label>
            <textarea
              id="checkin-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="변경 내용 설명 (선택)"
              disabled={isPending}
              rows={3}
              className="rounded-lg border border-[#97A8A1] bg-white px-3 py-2 text-xs text-[#1E3D33] placeholder-[#8A8A8A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30 disabled:cursor-not-allowed disabled:bg-[#F5F8F6] resize-none"
            />
          </div>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-sm text-[#B4483F]">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full border-[#D7E1DB] px-4 text-xs font-semibold"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-9 rounded-full bg-[#1C7F59] px-4 text-xs font-semibold text-white hover:bg-[#166749]"
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

function EqpParamDiffTableRow({ row }: { row: EqpParamDiffRow }) {
  const tone = resolveDiffTone(row.status)

  return (
    <TableRow className={`${tone.rowClassName} ${tone.hoverClassName}`}>
      <TableCell>
        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${tone.badgeClassName}`}>
          {tone.label}
        </span>
      </TableCell>
      <TableCell className={row.status === 'deleted' ? 'text-xs text-[#97A39C] line-through' : 'text-xs text-[#22322B]'}>
        {row.paramName || '-'}
      </TableCell>
      <TableCell className="text-xs">
        <DiffValuePair
          status={row.status}
          parentValue={row.parentValue}
          branchValue={row.branchValue}
        />
      </TableCell>
      <TableCell className="text-xs">
        <DiffValuePair
          status={row.status}
          parentValue={row.parentDescription}
          branchValue={row.branchDescription}
        />
      </TableCell>
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
    return <DiffCellValue value={branchValue} className="text-[#22322B]" />
  }

  if (status === 'deleted') {
    return <DiffCellValue value={parentValue} className="text-[#97A39C] line-through" />
  }

  if (parentValue === branchValue) {
    return <DiffCellValue value={branchValue} className="text-[#22322B]" />
  }

  return (
    <div className="space-y-1">
      <DiffCellValue value={parentValue} className="text-[#97A39C] line-through" />
      <DiffCellValue value={branchValue} className="font-medium text-[#1C7F59]" />
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
      <span className="text-[#97A39C]">...</span>
    </span>
  )
}

function resolveDiffTone(status: EqpParamDiffStatus) {
  if (status === 'added') {
    return {
      label: 'Add',
      rowClassName: 'bg-[#F0FFF7]',
      hoverClassName: 'hover:bg-[#F0FFF7]',
      badgeClassName: 'bg-[#D1F5E7] text-[#1C7F59]',
    }
  }

  if (status === 'changed') {
    return {
      label: 'Change',
      rowClassName: 'bg-[#FFFDF0]',
      hoverClassName: 'hover:bg-[#FFFDF0]',
      badgeClassName: 'bg-[#FFF0C0] text-[#7A5800]',
    }
  }

  return {
    label: 'Delete',
    rowClassName: 'bg-[#FFF7F7]',
    hoverClassName: 'hover:bg-[#FFF7F7]',
    badgeClassName: 'bg-[#FAD9D7] text-[#B4483F]',
  }
}
