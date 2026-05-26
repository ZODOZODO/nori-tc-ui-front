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
import type { ModelInfo } from '@/features/model/types/model.types'

const BUSINESS_GROUP_MODEL_COLUMN_COUNT = 6
const BUSINESS_GROUP_MODEL_SKELETON_ROW_COUNT = 8

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

  return new Intl.DateTimeFormat('ko-KR', {
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
 * business_app 선택 시 메모리상 모델 정보와 동일한 형식의 모델 목록을 표시합니다.
 */
export const BusinessGroupModelTable = memo(function BusinessGroupModelTable({
  groupName,
  models,
  isLoading,
  isFetching,
}: BusinessGroupModelTableProps) {
  const [selectedModelVersionKey, setSelectedModelVersionKey] = useState<number | null>(null)

  const sortedModels = useMemo(
    () => [...models].sort((firstItem, secondItem) => secondItem.updatedAt.localeCompare(firstItem.updatedAt)),
    [models],
  )
  const effectiveSelectedModelVersionKey = selectedModelVersionKey ?? sortedModels[0]?.modelVersionKey ?? null

  return (
    <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E4EAE6] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#213028]">{groupName}</h2>
        <span className="text-xs text-[#7A8680]">모델 {models.length}개</span>
      </div>

      <div className="overflow-auto">
        {isLoading ? (
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="bg-[#F6F9F7]">
                <TableHead>Model Name</TableHead>
                <TableHead>Model Version</TableHead>
                <TableHead>status</TableHead>
                <TableHead>description</TableHead>
                <TableHead>updated_by</TableHead>
                <TableHead>updated_at</TableHead>
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
          <p className="py-10 text-center text-sm text-[#647169]">
            이 business app에서 참조 중인 모델이 없습니다.
          </p>
        ) : (
          <SelectableTable<ModelInfo>
            testId="selectable-table-business-group-model"
            columns={BUSINESS_GROUP_MODEL_COLUMNS}
            rows={sortedModels}
            rowKey={(row) => row.modelVersionKey}
            tableClassName="min-w-[980px]"
            wrapRow={(row, _rowIdx, children) => (
              <TableRow
                data-state={
                  effectiveSelectedModelVersionKey === row.modelVersionKey ? 'selected' : undefined
                }
                onClick={() => setSelectedModelVersionKey(row.modelVersionKey)}
                onContextMenu={() => setSelectedModelVersionKey(row.modelVersionKey)}
              >
                {children}
              </TableRow>
            )}
          />
        )}
      </div>

      {isFetching && !isLoading ? (
        <p className="mt-2 text-xs text-[#7A8680]">모델 데이터를 동기화 중입니다.</p>
      ) : null}
    </section>
  )
})
