import { useMemo, useState } from 'react'
import { TableRow } from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { useI18n } from '@/i18n/i18n-context'
import { useGatewayDlq } from '../hooks/useGatewayDlq'
import { DLQ_PAGE_SIZE, filterDlqRows, formatDlqTime } from '../lib/dlq-format'
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
  const { t } = useI18n()
  const query = useGatewayDlq()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DLQ_PAGE_SIZE)

  const sortedEntries = useMemo<GatewayDlqEntry[]>(() => {
    const items = query.data ?? []
    return [...items].sort((left, right) => right.occurredAt - left.occurredAt)
  }, [query.data])

  const filteredEntries = useMemo(
    () => filterDlqRows(sortedEntries, GATEWAY_DLQ_COLUMNS, searchKeyword),
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
      title={t('dlq.panel.gateway')}
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
