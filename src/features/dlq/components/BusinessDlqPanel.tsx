import { useMemo, useState } from 'react'
import { TableRow } from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { useI18n } from '@/i18n/i18n-context'
import { useBusinessDlq } from '../hooks/useBusinessDlq'
import { useDlqLineScope } from '../hooks/useDlqLineScope'
import { DLQ_PAGE_SIZE, filterDlqRows, formatDlqTime } from '../lib/dlq-format'
import { filterDlqEntriesByLine } from '../lib/dlq-line-scope'
import type { BusinessDlqEntry } from '../types/dlq.types'
import { DlqTableShell } from './DlqTableShell'

// 컬럼 헤더는 모듈 상수라 t() 직접 호출이 불가능하므로, t 를 받는 팩토리로 두고
// 컴포넌트에서 useMemo([t]) 로 빌드한다(C4). 순수 jargon 헤더(ID/TTL)는 리터럴 유지.
const buildBusinessDlqColumns = (
  t: (key: string) => string,
): ReadonlyArray<ColumnDef<BusinessDlqEntry>> => [
  { key: 'dlqId', header: 'ID', accessor: (row) => row.dlqId, maxWidth: '24em' },
  { key: 'source', header: t('dlq.col.source'), accessor: (row) => row.source ?? '-' },
  { key: 'stage', header: t('dlq.col.stage'), accessor: (row) => row.stage ?? '-' },
  { key: 'topic', header: t('dlq.col.topic'), accessor: (row) => row.topic ?? '-', maxWidth: '24em' },
  { key: 'partition', header: t('dlq.col.partition'), accessor: (row) => row.partition?.toString() ?? '-' },
  { key: 'offset', header: t('dlq.col.offset'), accessor: (row) => row.offset?.toString() ?? '-' },
  { key: 'eqpId', header: t('dlq.col.equipment'), accessor: (row) => row.eqpId ?? '-' },
  { key: 'messageType', header: t('dlq.col.messageType'), accessor: (row) => row.messageType ?? '-' },
  { key: 'messageName', header: t('dlq.col.messageName'), accessor: (row) => row.messageName ?? '-' },
  { key: 'reasonCode', header: t('dlq.col.reasonCode'), accessor: (row) => row.reasonCode ?? '-' },
  {
    key: 'reasonMessage',
    header: t('dlq.col.reason'),
    accessor: (row) => row.reasonMessage ?? '-',
    maxWidth: '24em',
  },
  { key: 'occurredAt', header: t('dlq.col.occurredAt'), accessor: (row) => formatDlqTime(row.occurredAt) },
  {
    key: 'payloadRef',
    header: t('dlq.col.payloadRef'),
    accessor: (row) => row.payloadRef ?? '-',
    maxWidth: '24em',
  },
  { key: 'ttlSeconds', header: 'TTL', accessor: (row) => row.ttlSeconds?.toString() ?? '-' },
]

export function BusinessDlqPanel() {
  const { t } = useI18n()
  const query = useBusinessDlq()
  const lineScope = useDlqLineScope()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DLQ_PAGE_SIZE)

  const columns = useMemo(() => buildBusinessDlqColumns(t), [t])

  const sortedEntries = useMemo<BusinessDlqEntry[]>(() => {
    const items = filterDlqEntriesByLine(query.data ?? [], (row) => row.eqpId, lineScope.scope)
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
      title={t('dlq.panel.business')}
      testId="dlq-panel-business"
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
      <SelectableTable<BusinessDlqEntry>
        testId="selectable-table-business-dlq"
        columns={columns}
        rows={pageItems}
        rowKey={(row) => row.dlqId}
        wrapRow={(row, _rowIdx, children) => (
          <TableRow data-testid={`dlq-row-business-${row.dlqId}`}>{children}</TableRow>
        )}
      />
    </DlqTableShell>
  )
}
