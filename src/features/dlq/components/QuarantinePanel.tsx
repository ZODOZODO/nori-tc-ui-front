import { useMemo, useState } from 'react'
import { TableRow } from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { useQuarantine } from '../hooks/useQuarantine'
import { DLQ_PAGE_SIZE, formatDlqTime } from '../lib/dlq-format'
import type { QuarantineEntry } from '../types/dlq.types'
import { DlqTableShell } from './DlqTableShell'

const QUARANTINE_COLUMNS: ReadonlyArray<ColumnDef<QuarantineEntry>> = [
  { key: 'equipmentId', header: '설비', accessor: (row) => row.equipmentId },
  { key: 'reasonCode', header: '사유 코드', accessor: (row) => row.reasonCode ?? '-' },
  {
    key: 'reasonMessage',
    header: '사유',
    accessor: (row) => row.reasonMessage ?? '-',
    maxWidth: '24em',
  },
  {
    key: 'quarantinedAt',
    header: '격리 시각',
    accessor: (row) => formatDlqTime(row.quarantinedAt),
  },
  { key: 'ttlSeconds', header: 'TTL', accessor: (row) => row.ttlSeconds?.toString() ?? '-' },
]

export function QuarantinePanel() {
  const query = useQuarantine()
  const [pageIndex, setPageIndex] = useState(0)

  const sortedEntries = useMemo<QuarantineEntry[]>(() => {
    const items = query.data ?? []
    return [...items].sort((left, right) => {
      const rightTime = Date.parse(right.quarantinedAt)
      const leftTime = Date.parse(left.quarantinedAt)
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
      title="격리 설비"
      testId="dlq-panel-quarantine"
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
      <SelectableTable<QuarantineEntry>
        testId="selectable-table-quarantine"
        columns={QUARANTINE_COLUMNS}
        rows={pageItems}
        rowKey={(row) => row.equipmentId}
        wrapRow={(row, _rowIdx, children) => (
          <TableRow data-testid={`dlq-row-quarantine-${row.equipmentId}`}>
            {children}
          </TableRow>
        )}
      />
    </DlqTableShell>
  )
}
