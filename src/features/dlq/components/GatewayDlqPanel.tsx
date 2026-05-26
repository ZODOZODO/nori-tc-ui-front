import { useMemo, useState } from 'react'
import { TableRow } from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { useGatewayDlq } from '../hooks/useGatewayDlq'
import { DLQ_PAGE_SIZE, formatDlqTime } from '../lib/dlq-format'
import type { GatewayDlqEntry } from '../types/dlq.types'
import { DlqTableShell } from './DlqTableShell'

const GATEWAY_DLQ_COLUMNS: ReadonlyArray<ColumnDef<GatewayDlqEntry>> = [
  { key: 'dlqId', header: 'ID', accessor: (row) => row.dlqId, maxWidth: '24em' },
  { key: 'equipmentId', header: '설비', accessor: (row) => row.equipmentId },
  { key: 'commInterfaceType', header: 'IF', accessor: (row) => row.commInterfaceType ?? '-' },
  { key: 'socketType', header: '소켓', accessor: (row) => row.socketType ?? '-' },
  { key: 'stage', header: '단계', accessor: (row) => row.stage ?? '-' },
  { key: 'reasonCode', header: '사유 코드', accessor: (row) => row.reasonCode ?? '-' },
  {
    key: 'reasonMessage',
    header: '사유',
    accessor: (row) => row.reasonMessage ?? '-',
    maxWidth: '24em',
  },
  { key: 'occurredAt', header: '발생 시각', accessor: (row) => formatDlqTime(row.occurredAt) },
  {
    key: 'payloadRefKey',
    header: 'payload 참조',
    accessor: (row) => row.payloadRefKey ?? '-',
    maxWidth: '24em',
  },
  { key: 'ttlSeconds', header: 'TTL', accessor: (row) => row.ttlSeconds?.toString() ?? '-' },
]

export function GatewayDlqPanel() {
  const query = useGatewayDlq()
  const [pageIndex, setPageIndex] = useState(0)

  const sortedEntries = useMemo<GatewayDlqEntry[]>(() => {
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
      title="Gateway DLQ"
      testId="dlq-panel-gateway"
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
      <SelectableTable<GatewayDlqEntry>
        testId="selectable-table-gateway-dlq"
        columns={GATEWAY_DLQ_COLUMNS}
        rows={pageItems}
        rowKey={(row) => row.dlqId}
        wrapRow={(row, _rowIdx, children) => (
          <TableRow data-testid={`dlq-row-gateway-${row.dlqId}`}>{children}</TableRow>
        )}
      />
    </DlqTableShell>
  )
}
