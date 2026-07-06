import { useQuery } from '@tanstack/react-query'
import { liveMapDemoRunApi } from '../api/live-map-demo-run.api'

// run 이력 목록(과거·실행중 모두, DB 출처)을 모달 열림 동안 폴링. 목록이 실행중 run 을 담으므로 모달을 닫았다
// 다시 열어도 재부착이 자연히 성립한다(로컬 activeRunId 상태 없이 서버 목록에서 나옴). 단건 폴링과 달리 terminal
// 중단 로직이 없다 — 목록에는 실행중 run 이 계속 섞일 수 있어 항상 폴링한다.
export function useSimulatorRunList(enabled = true) {
  return useQuery({
    queryKey: ['live-map-demo-run-list'],
    queryFn: () => liveMapDemoRunApi.listRuns(),
    enabled,
    staleTime: 1_000,
    refetchInterval: 3_000,
  })
}
