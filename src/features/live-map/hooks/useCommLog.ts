import { useQuery } from '@tanstack/react-query'
import { commLogApi } from '../api/comm-log.api'

export function useCommLog(eqpId: string | null, type: 'eqp' | 'mes' | 'all' = 'all') {
  return useQuery({
    queryKey: ['comm-log', eqpId, type],
    queryFn: () => commLogApi.getLogs(eqpId!, type),
    enabled: !!eqpId,
    staleTime: 5_000,
    refetchInterval: 10_000,
  })
}
