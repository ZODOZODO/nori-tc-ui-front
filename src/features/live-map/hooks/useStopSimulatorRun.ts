import { useMutation, useQueryClient } from '@tanstack/react-query'
import { liveMapDemoRunApi } from '../api/live-map-demo-run.api'

// 모달 종료 → orchestrator stopRun. 성공 시 해당 runId 폴링 쿼리를 무효화해 즉시 종료 상태를 반영.
export function useStopSimulatorRun() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (runId: string) => liveMapDemoRunApi.stopRun(runId),
    onSuccess: async (_response, runId) => {
      await queryClient.invalidateQueries({ queryKey: ['live-map-demo-run', runId] })
    },
  })
}
