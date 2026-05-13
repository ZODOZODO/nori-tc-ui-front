import { useQuery } from '@tanstack/react-query'
import { dlqApi } from '../api/dlq.api'

/**
 * Business DLQ 항목 react-query 훅. 사용자 새로고침만 trigger — 자동 polling 없음.
 */
export function useBusinessDlq() {
  return useQuery({
    queryKey: ['dlq', 'business'],
    queryFn: dlqApi.fetchBusinessDlq,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
