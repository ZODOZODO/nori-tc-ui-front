import { useQuery } from '@tanstack/react-query'
import { liveMapDemoApi } from '../api/live-map-demo.api'
import type { LiveMapDemoTestType } from '../types/live-map.types'

export function useLiveMapDemoScenarios(testType: LiveMapDemoTestType, enabled = true) {
  return useQuery({
    queryKey: ['live-map-demo-scenarios', testType],
    queryFn: () => liveMapDemoApi.getScenarios(testType),
    enabled,
    staleTime: 60_000,
  })
}
