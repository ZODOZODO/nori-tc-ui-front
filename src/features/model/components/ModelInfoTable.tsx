import { memo, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/i18n/i18n-context'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SelectableTable, type ColumnDef } from '@/shared/components/SelectableTable'
import { resolveDateLocale } from '@/shared/lib/date-locale'
import { TableSectionHeader } from '@/shared/layout/TableSectionHeader'
import type { ModelInfo } from '../types/model.types'

const MODEL_INFO_COLUMN_COUNT = 6
const MODEL_INFO_SKELETON_ROW_COUNT = 8

interface ModelInfoTableProps {
  models: ModelInfo[]
  isLoading: boolean
  isFetching: boolean
  compactHeight?: boolean
  onSelectRow: (modelVersionKey: number) => void
  onOpenDetail: (model: ModelInfo) => void
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

/**
 * 모델 상태값을 Badge variant로 변환합니다.
 */
const resolveStatusBadgeVariant = (status: string): 'default' | 'develop' | 'warning' | 'outline' => {
  const normalizedStatus = status.trim().toUpperCase()

  if (normalizedStatus === 'OPERATE') {
    return 'default'
  }

  if (normalizedStatus === 'DEVELOP') {
    return 'develop'
  }

  if (normalizedStatus === 'DEPRECATED') {
    return 'warning'
  }

  return 'outline'
}

/**
 * design.pen의 Model 정보 테이블을 렌더링합니다.
 * - updatedAt 내림차순 정렬
 * - 단일 클릭: 모델 선택 (wrapRow onClick → onSelectRow) — 선택 행 하이라이트는 표시하지 않음
 * - 더블 클릭: Version 화면(탭) 오픈 (wrapRow onDoubleClick → onOpenDetail)
 * - 셀 영역 Ctrl+C → 클립보드 TSV (SelectableTable rangeCopy)
 */
export const ModelInfoTable = memo(function ModelInfoTable({
  models,
  isLoading,
  isFetching,
  compactHeight = false,
  onSelectRow,
  onOpenDetail,
}: ModelInfoTableProps) {
  const { t } = useI18n()
  const sortedModels = useMemo(
    () => [...models].sort((firstItem, secondItem) => secondItem.updatedAt.localeCompare(firstItem.updatedAt)),
    [models],
  )

  const columns = useMemo<ColumnDef<ModelInfo>[]>(
    () => [
      {
        key: 'modelName',
        header: 'Model Name',
        accessor: (row) => row.modelName,
      },
      {
        key: 'modelVersion',
        header: 'Model Version',
        accessor: (row) => row.modelVersion,
      },
      {
        key: 'status',
        header: 'status',
        accessor: (row) => row.status,
        renderCell: (row) => (
          <Badge variant={resolveStatusBadgeVariant(row.status)}>{row.status}</Badge>
        ),
      },
      {
        key: 'description',
        header: 'description',
        accessor: (row) => row.description ?? '—',
      },
      {
        key: 'updatedBy',
        header: 'updated_by',
        accessor: (row) => row.updatedBy,
      },
      {
        key: 'updatedAt',
        header: 'updated_at',
        accessor: (row) => formatDateTime(row.updatedAt),
      },
    ],
    [],
  )

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-soft-sm">
      <TableSectionHeader title={t('model.infoTable.title')} className="mb-3" />

      {isLoading ? (
        <div className={cn('overflow-auto', compactHeight ? 'max-h-75' : 'flex-1')}>
          <Table className="min-w-245">
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead>Model Name</TableHead>
                <TableHead>Model Version</TableHead>
                <TableHead>status</TableHead>
                <TableHead>description</TableHead>
                <TableHead>updated_by</TableHead>
                <TableHead>updated_at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: MODEL_INFO_SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                <TableRow key={`model-info-skeleton-${rowIndex}`} data-testid="model-info-skeleton">
                  {Array.from({ length: MODEL_INFO_COLUMN_COUNT }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <SelectableTable
          columns={columns}
          rows={sortedModels}
          rowKey={(row) => row.modelVersionKey}
          features={{ rangeCopy: true }}
          testId="selectable-table-model-info"
          containerClassName={cn(compactHeight ? 'max-h-75' : 'flex-1')}
          tableClassName="min-w-245"
          emptyState={t('model.infoTable.empty')}
          wrapRow={(model, _rowIdx, children) => (
            <TableRow
              onClick={() => onSelectRow(model.modelVersionKey)}
              onDoubleClick={() => onOpenDetail(model)}
              className="cursor-pointer"
            >
              {children}
            </TableRow>
          )}
        />
      )}

      {isFetching && !isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">{t('model.infoTable.syncing')}</p>
      ) : null}
    </section>
  )
})
