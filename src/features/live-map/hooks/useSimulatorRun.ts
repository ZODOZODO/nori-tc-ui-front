import { useQuery } from '@tanstack/react-query'
import { liveMapDemoRunApi, type SimulatorRunResponse } from '../api/live-map-demo-run.api'

const TERMINAL_RUN_STATES = new Set(['TERMINAL', 'CANCELED', 'FAILED'])

export const isTerminalRunState = (state: string | undefined): boolean =>
  state !== undefined && TERMINAL_RUN_STATES.has(state)

// runId 가 있는 동안 Run 상태(시작/진행/종료)를 폴링. 종료 상태(TERMINAL/CANCELED/FAILED)에 도달하면 폴링 중단.
export function useSimulatorRun(runId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['live-map-demo-run', runId],
    queryFn: () => liveMapDemoRunApi.getRun(runId as string),
    enabled: enabled && runId !== null,
    staleTime: 1_000,
    refetchInterval: (query) => {
      const data = query.state.data as SimulatorRunResponse | undefined
      return isTerminalRunState(data?.state) ? false : 3_000
    },
  })
}
