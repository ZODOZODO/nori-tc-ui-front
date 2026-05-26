import { useMemo, useState } from 'react'
import { TableRow } from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { useRepairTasks } from '../hooks/useRepairTasks'
import { DLQ_PAGE_SIZE, formatDlqTime } from '../lib/dlq-format'
import type { RepairTaskEntry } from '../types/dlq.types'
import { DlqTableShell } from './DlqTableShell'

const REPAIR_TASK_COLUMNS: ReadonlyArray<ColumnDef<RepairTaskEntry>> = [
  { key: 'taskId', header: 'Task ID', accessor: (row) => row.taskId, maxWidth: '24em' },
  { key: 'eqpId', header: '설비', accessor: (row) => row.eqpId },
  { key: 'commandType', header: '커맨드', accessor: (row) => row.commandType },
  { key: 'repairAction', header: '액션', accessor: (row) => row.repairAction },
  { key: 'errorCode', header: '에러 코드', accessor: (row) => row.errorCode ?? '-' },
  {
    key: 'errorMessage',
    header: '에러 메시지',
    accessor: (row) => row.errorMessage ?? '-',
    maxWidth: '24em',
  },
  { key: 'createdAt', header: '생성 시각', accessor: (row) => formatDlqTime(row.createdAt) },
]

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
      <SelectableTable<RepairTaskEntry>
        testId="selectable-table-repair-task"
        columns={REPAIR_TASK_COLUMNS}
        rows={pageItems}
        rowKey={(row) => row.taskId}
        wrapRow={(row, _rowIdx, children) => (
          <TableRow data-testid={`dlq-row-repair-task-${row.taskId}`}>{children}</TableRow>
        )}
      />
    </DlqTableShell>
  )
}
