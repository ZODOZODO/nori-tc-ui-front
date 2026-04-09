import { useQuery } from '@tanstack/react-query'
import { liveMapApi } from '../api/live-map.api'

export function useLiveMap() {
  return useQuery({
    queryKey: ['live-map'],
    queryFn: () => liveMapApi.getLiveMap(),
    staleTime: 5_000,
    refetchInterval: 5_000,
  })
}
