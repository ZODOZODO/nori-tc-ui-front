import { useMutation, useQueryClient } from '@tanstack/react-query'
import { liveMapDemoRunApi } from '../api/live-map-demo-run.api'

// 진행 테이블 행별 종료 → orchestrator stopTarget(설비 단위). 성공 시 해당 runId 폴링 쿼리를 무효화해 즉시 상태를 반영.
export function useStopSimulatorTarget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ runId, eqpId }: { runId: string; eqpId: string }) =>
      liveMapDemoRunApi.stopTarget(runId, eqpId),
    onSuccess: async (_response, { runId }) => {
      await queryClient.invalidateQueries({ queryKey: ['live-map-demo-run', runId] })
    },
  })
}
