import { useQuery } from '@tanstack/react-query'
import { lineApi, type LineResponse } from '@/shared/api/line.api'

export const lineQueryKeys = {
  list: () => ['line', 'list'] as const,
}

/**
 * 활성 라인 목록을 조회합니다. 라인은 마스터성 데이터라 staleTime 을 길게 두고
 * 자동 refetch 는 두지 않습니다(상단바 드롭다운 / eqp 폼 옵션 공용).
 */
export function useLineList() {
  return useQuery<LineResponse[]>({
    queryKey: lineQueryKeys.list(),
    queryFn: () => lineApi.getLineList(),
    staleTime: 60_000,
  })
}
