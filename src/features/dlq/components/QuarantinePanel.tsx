import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useQuarantine } from '../hooks/useQuarantine'
import { DLQ_PAGE_SIZE, formatDlqTime } from '../lib/dlq-format'
import type { QuarantineEntry } from '../types/dlq.types'
import { DlqTableShell } from './DlqTableShell'

const TRUNCATE_CELL_CLASS = 'max-w-[24em] truncate'

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
      <Table>
        <TableHeader className="bg-[#F6F8F6]">
          <TableRow className="bg-[#F6F8F6] hover:bg-[#F6F8F6]">
            <TableHead>설비</TableHead>
            <TableHead>사유 코드</TableHead>
            <TableHead>사유</TableHead>
            <TableHead>격리 시각</TableHead>
            <TableHead>TTL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((item) => (
            <TableRow
              key={item.equipmentId}
              data-testid={`dlq-row-quarantine-${item.equipmentId}`}
            >
              <TableCell>{item.equipmentId}</TableCell>
              <TableCell>{item.reasonCode ?? '-'}</TableCell>
              <TableCell
                className={TRUNCATE_CELL_CLASS}
                title={item.reasonMessage ?? ''}
              >
                {item.reasonMessage ?? '-'}
              </TableCell>
              <TableCell>{formatDlqTime(item.quarantinedAt)}</TableCell>
              <TableCell>{item.ttlSeconds ?? '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DlqTableShell>
  )
}
