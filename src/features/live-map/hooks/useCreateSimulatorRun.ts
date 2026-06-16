import { useMutation } from '@tanstack/react-query'
import { liveMapDemoRunApi, type SimulatorRunCreateRequest } from '../api/live-map-demo-run.api'

// 모달 시작 → orchestrator createRun. 반환된 runId 로 useSimulatorRun 폴링을 시작하므로 별도 invalidate 불요.
export function useCreateSimulatorRun() {
  return useMutation({
    mutationFn: (request: SimulatorRunCreateRequest) => liveMapDemoRunApi.createRun(request),
  })
}
