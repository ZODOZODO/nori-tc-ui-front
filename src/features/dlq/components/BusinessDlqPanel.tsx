import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useBusinessDlq } from '../hooks/useBusinessDlq'
import { DLQ_PAGE_SIZE, formatDlqTime } from '../lib/dlq-format'
import type { BusinessDlqEntry } from '../types/dlq.types'
import { DlqTableShell } from './DlqTableShell'

const TRUNCATE_CELL_CLASS = 'max-w-[24em] truncate'

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
      <Table>
        <TableHeader className="bg-[#F6F8F6]">
          <TableRow className="bg-[#F6F8F6] hover:bg-[#F6F8F6]">
            <TableHead>ID</TableHead>
            <TableHead>출처</TableHead>
            <TableHead>단계</TableHead>
            <TableHead>토픽</TableHead>
            <TableHead>파티션</TableHead>
            <TableHead>오프셋</TableHead>
            <TableHead>설비</TableHead>
            <TableHead>타입</TableHead>
            <TableHead>이름</TableHead>
            <TableHead>사유 코드</TableHead>
            <TableHead>사유</TableHead>
            <TableHead>발생 시각</TableHead>
            <TableHead>payload 참조</TableHead>
            <TableHead>TTL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((item) => (
            <TableRow key={item.dlqId} data-testid={`dlq-row-business-${item.dlqId}`}>
              <TableCell className={TRUNCATE_CELL_CLASS} title={item.dlqId}>
                {item.dlqId}
              </TableCell>
              <TableCell>{item.source ?? '-'}</TableCell>
              <TableCell>{item.stage ?? '-'}</TableCell>
              <TableCell className={TRUNCATE_CELL_CLASS} title={item.topic ?? ''}>
                {item.topic ?? '-'}
              </TableCell>
              <TableCell>{item.partition ?? '-'}</TableCell>
              <TableCell>{item.offset ?? '-'}</TableCell>
              <TableCell>{item.eqpId ?? '-'}</TableCell>
              <TableCell>{item.messageType ?? '-'}</TableCell>
              <TableCell>{item.messageName ?? '-'}</TableCell>
              <TableCell>{item.reasonCode ?? '-'}</TableCell>
              <TableCell
                className={TRUNCATE_CELL_CLASS}
                title={item.reasonMessage ?? ''}
              >
                {item.reasonMessage ?? '-'}
              </TableCell>
              <TableCell>{formatDlqTime(item.occurredAt)}</TableCell>
              <TableCell
                className={TRUNCATE_CELL_CLASS}
                title={item.payloadRef ?? ''}
              >
                {item.payloadRef ?? '-'}
              </TableCell>
              <TableCell>{item.ttlSeconds ?? '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DlqTableShell>
  )
}
