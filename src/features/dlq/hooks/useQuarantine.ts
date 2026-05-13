import { useQuery } from '@tanstack/react-query'
import { dlqApi } from '../api/dlq.api'

/**
 * 격리 설비 항목 react-query 훅. 사용자 새로고침만 trigger — 자동 polling 없음.
 */
export function useQuarantine() {
  return useQuery({
    queryKey: ['dlq', 'quarantine'],
    queryFn: dlqApi.fetchQuarantine,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
