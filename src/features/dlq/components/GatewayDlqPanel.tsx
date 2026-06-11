import { useMemo, useState } from 'react'
import { TableRow } from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { useI18n } from '@/i18n/i18n-context'
import { useDlqLineScope } from '../hooks/useDlqLineScope'
import { useGatewayDlq } from '../hooks/useGatewayDlq'
import { DLQ_PAGE_SIZE, filterDlqRows, formatDlqTime } from '../lib/dlq-format'
import { filterDlqEntriesByLine } from '../lib/dlq-line-scope'
import type { GatewayDlqEntry } from '../types/dlq.types'
import { DlqTableShell } from './DlqTableShell'

// 컬럼 헤더 팩토리(C4). 순수 jargon 헤더(ID/IF/TTL)는 리터럴 유지.
const buildGatewayDlqColumns = (
  t: (key: string) => string,
): ReadonlyArray<ColumnDef<GatewayDlqEntry>> => [
  { key: 'dlqId', header: 'ID', accessor: (row) => row.dlqId, maxWidth: '24em' },
  { key: 'equipmentId', header: t('dlq.col.equipment'), accessor: (row) => row.equipmentId },
  { key: 'commInterfaceType', header: 'IF', accessor: (row) => row.commInterfaceType ?? '-' },
  { key: 'socketType', header: t('dlq.col.socket'), accessor: (row) => row.socketType ?? '-' },
  { key: 'stage', header: t('dlq.col.stage'), accessor: (row) => row.stage ?? '-' },
  { key: 'reasonCode', header: t('dlq.col.reasonCode'), accessor: (row) => row.reasonCode ?? '-' },
  {
    key: 'reasonMessage',
    header: t('dlq.col.reason'),
    accessor: (row) => row.reasonMessage ?? '-',
    maxWidth: '24em',
  },
  { key: 'occurredAt', header: t('dlq.col.occurredAt'), accessor: (row) => formatDlqTime(row.occurredAt) },
  {
    key: 'payloadRefKey',
    header: t('dlq.col.payloadRef'),
    accessor: (row) => row.payloadRefKey ?? '-',
    maxWidth: '24em',
  },
  { key: 'ttlSeconds', header: 'TTL', accessor: (row) => row.ttlSeconds?.toString() ?? '-' },
]

export function GatewayDlqPanel() {
  const { t } = useI18n()
  const query = useGatewayDlq()
  const lineScope = useDlqLineScope()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DLQ_PAGE_SIZE)

  const columns = useMemo(() => buildGatewayDlqColumns(t), [t])

  const sortedEntries = useMemo<GatewayDlqEntry[]>(() => {
    const items = filterDlqEntriesByLine(query.data ?? [], (row) => row.equipmentId, lineScope.scope)
    return items.sort((left, right) => right.occurredAt - left.occurredAt)
  }, [query.data, lineScope.scope])

  const filteredEntries = useMemo(
    () => filterDlqRows(sortedEntries, columns, searchKeyword),
    [sortedEntries, columns, searchKeyword],
  )

  const totalCount = filteredEntries.length
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(Math.max(page, 1), pageCount)
  const pageItems = filteredEntries.slice((safePage - 1) * pageSize, safePage * pageSize)

  const lastUpdatedAt =
    query.dataUpdatedAt && query.dataUpdatedAt > 0 ? query.dataUpdatedAt : null
  const errorMessage =
    query.error instanceof Error ? query.error.message : lineScope.errorMessage
  const emptyMessage =
    searchKeyword.trim() === '' ? t('dlq.table.empty') : t('dlq.table.searchNoResult')

  return (
    <DlqTableShell
      title={t('dlq.panel.gateway')}
      testId="dlq-panel-gateway"
      totalCount={totalCount}
      isLoading={query.isPending || lineScope.isPending}
      isFetching={query.isFetching}
      isError={query.isError || lineScope.isError}
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
        columns={columns}
        rows={pageItems}
        rowKey={(row) => row.dlqId}
        wrapRow={(row, _rowIdx, children) => (
          <TableRow data-testid={`dlq-row-gateway-${row.dlqId}`}>{children}</TableRow>
        )}
      />
    </DlqTableShell>
  )
}
