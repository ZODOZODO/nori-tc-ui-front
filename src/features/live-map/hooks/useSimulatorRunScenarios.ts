import { useQuery } from '@tanstack/react-query'
import { liveMapDemoRunApi } from '../api/live-map-demo-run.api'

// 신규 Run 경로 시나리오 카탈로그(R-5). job 경로(useLiveMapDemoScenarios)와 달리 testType 별 필터 없이
// 전체 카탈로그를 한 번 조회한다 — 시나리오는 2개(socket/modbus)뿐이라 선택 설비에 맞는 것을 사용자가 고른다.
export function useSimulatorRunScenarios(enabled = true) {
  return useQuery({
    queryKey: ['live-map-demo-run-scenarios'],
    queryFn: () => liveMapDemoRunApi.getScenarios(),
    enabled,
    staleTime: 60_000,
  })
}
