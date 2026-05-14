import { memo, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ModelInfo } from '@/features/model/types/model.types'

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
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-[#647169]">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    모델 정보를 불러오는 중입니다.
                  </span>
                </TableCell>
              </TableRow>
            ) : sortedModels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-[#647169]">
                  이 business app에서 참조 중인 모델이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              sortedModels.map((model) => (
                <TableRow
                  key={model.modelVersionKey}
                  data-state={
                    effectiveSelectedModelVersionKey === model.modelVersionKey ? 'selected' : undefined
                  }
                  onClick={() => setSelectedModelVersionKey(model.modelVersionKey)}
                  onContextMenu={() => setSelectedModelVersionKey(model.modelVersionKey)}
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
})
