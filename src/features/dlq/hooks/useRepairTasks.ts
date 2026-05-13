import { useQuery } from '@tanstack/react-query'
import { dlqApi } from '../api/dlq.api'

/**
 * Repair Task 항목 react-query 훅. 사용자 새로고침만 trigger — 자동 polling 없음.
 */
export function useRepairTasks() {
  return useQuery({
    queryKey: ['dlq', 'repair-task'],
    queryFn: dlqApi.fetchRepairTasks,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
