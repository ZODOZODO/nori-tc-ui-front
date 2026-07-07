import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRunHistoryGroups } from '@/features/live-map/lib/live-map-demo-run-history.ts'
import type { SimulatorRunResponse } from '@/features/live-map/api/live-map-demo-run.api.ts'

const run = (
  overrides: Partial<SimulatorRunResponse> & Pick<SimulatorRunResponse, 'runId' | 'createdAt'>,
): SimulatorRunResponse => ({
  mode: 'ALL',
  state: 'RUNNING',
  scenarioId: 'normal-flow',
  targets: [],
  ...overrides,
})

// AC-F3: 과거순(createdAt ASC) 정렬 — 최신이 맨 아래 + createdAt/scenarioId 노출 + 설비행 값.
test('과거 terminal run 이 createdAt ASC 로 정렬되고(최신이 맨 아래) 각 그룹이 scenario/시작시각/설비행을 담는다', () => {
  const groups = buildRunHistoryGroups([
    run({
      runId: 'run-old',
      createdAt: '2026-07-06T00:00:00Z',
      state: 'TERMINAL',
      scenarioId: 'socket-flow',
      targets: [
        { eqpId: 'EQP_A', state: 'COMPLETED', commInterface: 'SOCKET', completedCycleCount: 2, erroredCycleCount: 0, issuedLotRunIds: [] },
        { eqpId: 'EQP_B', state: 'CANCELED', commInterface: 'SOCKET', completedCycleCount: 0, erroredCycleCount: 1, issuedLotRunIds: [] },
      ],
    }),
    run({
      runId: 'run-new',
      createdAt: '2026-07-06T02:00:00Z',
      state: 'RUNNING',
      scenarioId: 'modbus-flow',
      targets: [
        { eqpId: 'PLC_1', state: 'RUNNING', commInterface: 'PLC', completedCycleCount: 5, erroredCycleCount: 0, issuedLotRunIds: [] },
      ],
    }),
  ])

  assert.equal(groups.length, 2)
  assert.equal(groups[0].runId, 'run-old', '오래된 run 이 먼저(위)')
  assert.equal(groups[1].runId, 'run-new', '최신 run 이 맨 아래')
  assert.equal(groups[1].createdAt, '2026-07-06T02:00:00Z', 'createdAt 노출')
  assert.equal(groups[0].scenarioId, 'socket-flow', 'scenarioId 노출')
  // 설비행 값 + 완료/전체 집계.
  assert.equal(groups[0].totalCount, 2)
  assert.equal(groups[0].completedCount, 1, 'COMPLETED 설비 1대')
  assert.equal(groups[0].targets[0].eqpId, 'EQP_A')
  assert.equal(groups[0].targets[1].erroredCycleCount, 1)
})

// AC-F2: 이번 세션에서 시작하지 않은 실행중 run 도 목록 mock 에 있으면 그룹 결과에 포함(재부착).
test('세션 밖에서 시작한 실행중 run 이 그룹 결과에 포함된다(재부착)', () => {
  const groups = buildRunHistoryGroups([
    run({
      runId: 'run-external',
      createdAt: '2026-07-06T03:00:00Z',
      state: 'RUNNING',
      targets: [
        { eqpId: 'EQP_X', state: 'RUNNING', commInterface: 'SOCKET', completedCycleCount: 0, erroredCycleCount: 0, issuedLotRunIds: [] },
      ],
    }),
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0].runId, 'run-external', '외부 세션 실행중 run 이 표시됨')
  assert.equal(groups[0].state, 'RUNNING')
  assert.equal(groups[0].totalCount, 1)
})

// AC-F1(변환 단위): 빈 목록 → 빈 그룹, targets 누락 방어.
test('빈 목록은 빈 그룹, targets 누락은 0건으로 방어한다', () => {
  assert.deepEqual(buildRunHistoryGroups([]), [])
  const groups = buildRunHistoryGroups([
    run({ runId: 'run-empty', createdAt: '2026-07-06T00:00:00Z', targets: undefined as unknown as [] }),
  ])
  assert.equal(groups[0].totalCount, 0)
  assert.equal(groups[0].completedCount, 0)
})
