import { useMemo, useState } from 'react'
import { TableRow } from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { useI18n } from '@/i18n/i18n-context'
import { useRepairTasks } from '../hooks/useRepairTasks'
import { DLQ_PAGE_SIZE, filterDlqRows, formatDlqTime } from '../lib/dlq-format'
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
  const { t } = useI18n()
  const query = useRepairTasks()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DLQ_PAGE_SIZE)

  const sortedEntries = useMemo<RepairTaskEntry[]>(() => {
    const items = query.data ?? []
    return [...items].sort((left, right) => {
      const rightTime = Date.parse(right.createdAt)
      const leftTime = Date.parse(left.createdAt)
      return rightTime - leftTime
    })
  }, [query.data])

  const filteredEntries = useMemo(
    () => filterDlqRows(sortedEntries, REPAIR_TASK_COLUMNS, searchKeyword),
    [sortedEntries, searchKeyword],
  )

  const totalCount = filteredEntries.length
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(Math.max(page, 1), pageCount)
  const pageItems = filteredEntries.slice((safePage - 1) * pageSize, safePage * pageSize)

  const lastUpdatedAt =
    query.dataUpdatedAt && query.dataUpdatedAt > 0 ? query.dataUpdatedAt : null
  const errorMessage = query.error instanceof Error ? query.error.message : null
  const emptyMessage =
    searchKeyword.trim() === '' ? t('dlq.table.empty') : t('dlq.table.searchNoResult')

  return (
    <DlqTableShell
      title={t('dlq.panel.repairTask')}
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
      searchKeyword={searchKeyword}
      onSearchChange={(value) => {
        setSearchKeyword(value)
        setPage(1)
      }}
      page={safePage}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(size) => {
        setPageSize(size)
        setPage(1)
      }}
      emptyMessage={emptyMessage}
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
