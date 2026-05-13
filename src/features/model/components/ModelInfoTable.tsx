import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ModelInfo } from '../types/model.types'

const MODEL_INFO_COLUMN_COUNT = 6
const MODEL_INFO_SKELETON_ROW_COUNT = 8

interface ModelInfoTableProps {
  models: ModelInfo[]
  selectedModelVersionKey: number | null
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
 * design.pen의 Model 정보 테이블을 렌더링합니다.
 * - updatedAt 내림차순 정렬
 * - row click: 선택
 * - row double click: Version 화면(탭) 오픈
 */
export function ModelInfoTable({
  models,
  selectedModelVersionKey,
  isLoading,
  isFetching,
  compactHeight = false,
  onSelectRow,
  onOpenDetail,
}: ModelInfoTableProps) {
  // updated_at 내림차순 정렬 (최근 수정 순)
  const sortedModels = useMemo(
    () => [...models].sort((firstItem, secondItem) => secondItem.updatedAt.localeCompare(firstItem.updatedAt)),
    [models],
  )

  return (
    <section className="flex h-full flex-col rounded-2xl border border-[#E4EAE6] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#213028]">Model 정보</h2>
      </div>

      <div className={cn('overflow-auto', compactHeight ? 'max-h-[300px]' : 'flex-1')}>
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
            {isLoading ? (
              Array.from({ length: MODEL_INFO_SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                <TableRow key={`model-info-skeleton-${rowIndex}`} data-testid="model-info-skeleton">
                  {Array.from({ length: MODEL_INFO_COLUMN_COUNT }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedModels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={MODEL_INFO_COLUMN_COUNT} className="py-10 text-center text-sm text-[#647169]">
                  표시할 모델이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              sortedModels.map((model) => (
                <TableRow
                  key={model.modelVersionKey}
                  data-state={selectedModelVersionKey === model.modelVersionKey ? 'selected' : undefined}
                  onClick={() => onSelectRow(model.modelVersionKey)}
                  onDoubleClick={() => onOpenDetail(model)}
                  className="cursor-pointer"
                >
                  <TableCell>{model.modelName}</TableCell>
                  <TableCell>{model.modelVersion}</TableCell>
                  <TableCell>
                    <Badge variant={resolveStatusBadgeVariant(model.status)}>{model.status}</Badge>
                  </TableCell>
                  <TableCell>{model.description ?? '—'}</TableCell>
                  <TableCell>{model.updatedBy}</TableCell>
                  <TableCell>{formatDateTime(model.updatedAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {isFetching && !isLoading ? (
        <p className="mt-2 text-xs text-[#7A8680]">모델 데이터를 동기화 중입니다.</p>
      ) : null}
    </section>
  )
}
