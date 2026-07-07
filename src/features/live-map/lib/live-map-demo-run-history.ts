import type { SimulatorRunResponse, SimulatorRunTarget } from '../api/live-map-demo-run.api'

// '시뮬레이션 진행 현황' run 그룹 1개 — 헤더(runId/연결유형/시나리오/시작시각/상태/완료·전체) + 설비별 행.
export interface RunHistoryGroup {
  runId: string
  mode: string
  scenarioId: string
  createdAt: string
  state: string
  completedCount: number
  totalCount: number
  targets: SimulatorRunTarget[]
}

// 목록 응답을 과거순(createdAt ASC) run 그룹 + 설비행으로 변환하는 순수 함수. createdAt 은 orchestrator 가
// Instant.toString()(항상 UTC 'Z')로 직렬화하므로 문자열 사전순 = 시간순 → 방어적으로 문자열 asc 재정렬한다.
// 최신 run 이 테이블 맨 아래에 오도록 오래된 것부터 나열한다(렌더가 목록 순서에 의존하지 않게 순수 함수가 정렬 보장).
export function buildRunHistoryGroups(runs: SimulatorRunResponse[]): RunHistoryGroup[] {
  return [...runs]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((run) => {
      const targets = run.targets ?? []
      return {
        runId: run.runId,
        mode: run.mode,
        scenarioId: run.scenarioId,
        createdAt: run.createdAt,
        state: run.state,
        completedCount: targets.filter((target) => target.state === 'COMPLETED').length,
        totalCount: targets.length,
        targets,
      }
    })
}
