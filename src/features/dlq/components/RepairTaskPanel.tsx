import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRepairTasks } from '../hooks/useRepairTasks'
import { DLQ_PAGE_SIZE, formatDlqTime } from '../lib/dlq-format'
import type { RepairTaskEntry } from '../types/dlq.types'
import { DlqTableShell } from './DlqTableShell'

const TRUNCATE_CELL_CLASS = 'max-w-[24em] truncate'

export function RepairTaskPanel() {
  const query = useRepairTasks()
  const [pageIndex, setPageIndex] = useState(0)

  const sortedEntries = useMemo<RepairTaskEntry[]>(() => {
    const items = query.data ?? []
    return [...items].sort((left, right) => {
      const rightTime = Date.parse(right.createdAt)
      const leftTime = Date.parse(left.createdAt)
      return rightTime - leftTime
    })
  }, [query.data])

  const totalCount = sortedEntries.length
  const pageCount = Math.max(1, Math.ceil(totalCount / DLQ_PAGE_SIZE))
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const pageItems = sortedEntries.slice(
    safePageIndex * DLQ_PAGE_SIZE,
    safePageIndex * DLQ_PAGE_SIZE + DLQ_PAGE_SIZE,
  )

  const lastUpdatedAt =
    query.dataUpdatedAt && query.dataUpdatedAt > 0 ? query.dataUpdatedAt : null
  const errorMessage = query.error instanceof Error ? query.error.message : null

  return (
    <DlqTableShell
      title="Repair Task"
      testId="dlq-panel-repair-task"
      totalCount={totalCount}
      isLoading={query.isPending}
      isFetching={query.isFetching}
      isError={query.isError}
      errorMessage={errorMessage}
      onRefresh={() => {
        void query.refetch()
      }}
      lastUpdatedAt={lastUpdatedAt}
      pageIndex={safePageIndex}
      pageCount={pageCount}
      canGoPrev={safePageIndex > 0}
      canGoNext={safePageIndex + 1 < pageCount}
      onMovePage={setPageIndex}
      emptyMessage="표시할 항목이 없습니다."
    >
      <Table>
        <TableHeader className="bg-[#F6F8F6]">
          <TableRow className="bg-[#F6F8F6] hover:bg-[#F6F8F6]">
            <TableHead>Task ID</TableHead>
            <TableHead>설비</TableHead>
            <TableHead>커맨드</TableHead>
            <TableHead>액션</TableHead>
            <TableHead>에러 코드</TableHead>
            <TableHead>에러 메시지</TableHead>
            <TableHead>생성 시각</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((item) => (
            <TableRow key={item.taskId} data-testid={`dlq-row-repair-task-${item.taskId}`}>
              <TableCell className={TRUNCATE_CELL_CLASS} title={item.taskId}>
                {item.taskId}
              </TableCell>
              <TableCell>{item.eqpId}</TableCell>
              <TableCell>{item.commandType}</TableCell>
              <TableCell>{item.repairAction}</TableCell>
              <TableCell>{item.errorCode ?? '-'}</TableCell>
              <TableCell
                className={TRUNCATE_CELL_CLASS}
                title={item.errorMessage ?? ''}
              >
                {item.errorMessage ?? '-'}
              </TableCell>
              <TableCell>{formatDlqTime(item.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DlqTableShell>
  )
}
