import { useQuery } from '@tanstack/react-query'
import { liveMapDemoApi } from '../api/live-map-demo.api'

export function useLiveMapDemoJobs(enabled = true, states?: string, limit = 100) {
  return useQuery({
    queryKey: ['live-map-demo-jobs', states ?? 'ALL', limit],
    queryFn: () => liveMapDemoApi.getJobs(states, limit),
    enabled,
    staleTime: 1_000,
    refetchInterval: enabled ? 5_000 : false,
  })
}
