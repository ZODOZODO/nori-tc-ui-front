import { memo, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { PagePagination } from '@/shared/layout/PagePagination'
import { TableSectionHeader } from '@/shared/layout/TableSectionHeader'
import { useI18n } from '@/i18n/i18n-context'
import { resolveDateLocale } from '@/shared/lib/date-locale'
import type { ModelInfo } from '@/features/model/types/model.types'

const BUSINESS_GROUP_MODEL_COLUMN_COUNT = 6
const BUSINESS_GROUP_MODEL_SKELETON_ROW_COUNT = 8
const BUSINESS_GROUP_MODEL_DEFAULT_PAGE_SIZE = 25

interface BusinessGroupModelTableProps {
  groupName: string
  models: ModelInfo[]
  isLoading: boolean
  isFetching: boolean
}

/**
 * 모델 상태값을 Badge variant로 변환합니다.
 */
const resolveStatusBadgeVariant = (status: string): 'default' | 'info' | 'warning' | 'outline' => {
  const normalizedStatus = status.trim().toUpperCase()

  if (normalizedStatus === 'OPERATE') {
    return 'default'
  }

  if (normalizedStatus === 'DEVELOP') {
    return 'info'
  }

  if (normalizedStatus === 'DEPRECATED') {
    return 'warning'
  }

  return 'outline'
}

/**
 * ISO 날짜 문자열을 화면 표시 문자열로 변환합니다.
 */
const formatDateTime = (isoDateTime: string): string => {
  const timestamp = Date.parse(isoDateTime)
  if (Number.isNaN(timestamp)) {
    return isoDateTime
  }

  return new Intl.DateTimeFormat(resolveDateLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))
}

const BUSINESS_GROUP_MODEL_COLUMNS: ReadonlyArray<ColumnDef<ModelInfo>> = [
  { key: 'modelName', header: 'Model Name', accessor: (row) => row.modelName },
  { key: 'modelVersion', header: 'Model Version', accessor: (row) => row.modelVersion },
  {
    key: 'status',
    header: 'status',
    accessor: (row) => row.status,
    renderCell: (row) => (
      <Badge variant={resolveStatusBadgeVariant(row.status)}>{row.status}</Badge>
    ),
  },
  { key: 'description', header: 'description', accessor: (row) => row.description ?? '—' },
  { key: 'updatedBy', header: 'updated_by', accessor: (row) => row.updatedBy },
  { key: 'updatedAt', header: 'updated_at', accessor: (row) => formatDateTime(row.updatedAt) },
]

/**
 * business_app 선택 시 메모리상 모델 정보를 nori-client 리스트 페이지 틀
 * (헤더+총건수 pill / 데이터 테이블 / 페이지네이션)로 표시합니다.
 * 검색은 좌측 사이드바에서만 제공하므로 콘텐츠 내 검색바는 두지 않습니다.
 */
export const BusinessGroupModelTable = memo(function BusinessGroupModelTable({
  groupName,
  models,
  isLoading,
  isFetching,
}: BusinessGroupModelTableProps) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(BUSINESS_GROUP_MODEL_DEFAULT_PAGE_SIZE)

  const sortedModels = useMemo(
    () => [...models].sort((firstItem, secondItem) => secondItem.updatedAt.localeCompare(firstItem.updatedAt)),
    [models],
  )

  const pageCount = Math.max(1, Math.ceil(sortedModels.length / pageSize))

  const pagedModels = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), pageCount)
    const start = (safePage - 1) * pageSize
    return sortedModels.slice(start, start + pageSize)
  }, [sortedModels, page, pageCount, pageSize])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <TableSectionHeader title={groupName} count={sortedModels.length} />

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4">
        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <Table className="min-w-245">
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>Model Name</TableHead>
                  <TableHead>Model Version</TableHead>
                  <TableHead>{t('eqp.col.status')}</TableHead>
                  <TableHead>{t('eqp.col.description')}</TableHead>
                  <TableHead>{t('eqp.col.updatedBy')}</TableHead>
                  <TableHead>{t('eqp.col.updatedAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: BUSINESS_GROUP_MODEL_SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                  <TableRow key={`business-group-model-skeleton-${rowIndex}`} data-testid="business-group-model-skeleton">
                    {Array.from({ length: BUSINESS_GROUP_MODEL_COLUMN_COUNT }).map((_, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : sortedModels.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t('eqp.business.empty')}
            </p>
          ) : (
            <SelectableTable<ModelInfo>
              testId="selectable-table-business-group-model"
              columns={BUSINESS_GROUP_MODEL_COLUMNS}
              rows={pagedModels}
              rowKey={(row) => row.modelVersionKey}
              tableClassName="min-w-245"
            />
          )}
        </div>

        {isFetching && !isLoading ? (
          <p className="mt-2 text-xs text-muted-foreground">{t('eqp.business.syncing')}</p>
        ) : null}
      </section>

      {!isLoading && sortedModels.length > 0 ? (
        <PagePagination
          total={sortedModels.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize)
            setPage(1)
          }}
        />
      ) : null}
    </div>
  )
})
