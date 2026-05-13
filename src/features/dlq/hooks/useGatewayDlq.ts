import { useQuery } from '@tanstack/react-query'
import { dlqApi } from '../api/dlq.api'

/**
 * Gateway DLQ 항목 react-query 훅. 사용자 새로고침만 trigger — 자동 polling 없음.
 */
export function useGatewayDlq() {
  return useQuery({
    queryKey: ['dlq', 'gateway'],
    queryFn: dlqApi.fetchGatewayDlq,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
