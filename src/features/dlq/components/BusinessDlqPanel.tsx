import { useMemo, useState } from 'react'
import { TableRow } from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { useBusinessDlq } from '../hooks/useBusinessDlq'
import { DLQ_PAGE_SIZE, formatDlqTime } from '../lib/dlq-format'
import type { BusinessDlqEntry } from '../types/dlq.types'
import { DlqTableShell } from './DlqTableShell'

const BUSINESS_DLQ_COLUMNS: ReadonlyArray<ColumnDef<BusinessDlqEntry>> = [
  { key: 'dlqId', header: 'ID', accessor: (row) => row.dlqId, maxWidth: '24em' },
  { key: 'source', header: '출처', accessor: (row) => row.source ?? '-' },
  { key: 'stage', header: '단계', accessor: (row) => row.stage ?? '-' },
  { key: 'topic', header: '토픽', accessor: (row) => row.topic ?? '-', maxWidth: '24em' },
  { key: 'partition', header: '파티션', accessor: (row) => row.partition?.toString() ?? '-' },
  { key: 'offset', header: '오프셋', accessor: (row) => row.offset?.toString() ?? '-' },
  { key: 'eqpId', header: '설비', accessor: (row) => row.eqpId ?? '-' },
  { key: 'messageType', header: '타입', accessor: (row) => row.messageType ?? '-' },
  { key: 'messageName', header: '이름', accessor: (row) => row.messageName ?? '-' },
  { key: 'reasonCode', header: '사유 코드', accessor: (row) => row.reasonCode ?? '-' },
  {
    key: 'reasonMessage',
    header: '사유',
    accessor: (row) => row.reasonMessage ?? '-',
    maxWidth: '24em',
  },
  { key: 'occurredAt', header: '발생 시각', accessor: (row) => formatDlqTime(row.occurredAt) },
  {
    key: 'payloadRef',
    header: 'payload 참조',
    accessor: (row) => row.payloadRef ?? '-',
    maxWidth: '24em',
  },
  { key: 'ttlSeconds', header: 'TTL', accessor: (row) => row.ttlSeconds?.toString() ?? '-' },
]

export function BusinessDlqPanel() {
  const query = useBusinessDlq()
  const [pageIndex, setPageIndex] = useState(0)

  const sortedEntries = useMemo<BusinessDlqEntry[]>(() => {
    const items = query.data ?? []
    return [...items].sort((left, right) => right.occurredAt - left.occurredAt)
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
      title="Business DLQ"
      testId="dlq-panel-business"
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
      <SelectableTable<BusinessDlqEntry>
        testId="selectable-table-business-dlq"
        columns={BUSINESS_DLQ_COLUMNS}
        rows={pageItems}
        rowKey={(row) => row.dlqId}
        wrapRow={(row, _rowIdx, children) => (
          <TableRow data-testid={`dlq-row-business-${row.dlqId}`}>{children}</TableRow>
        )}
      />
    </DlqTableShell>
  )
}
