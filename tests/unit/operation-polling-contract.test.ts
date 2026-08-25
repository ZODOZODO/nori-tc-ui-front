import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createFailResponse } from '@/shared/lib/api-error.ts'
import {
  isTerminalOperationState,
  pollOperationUntilTerminal,
  type OperationStatus,
} from '@/shared/lib/operation-status.ts'

/**
 * operation polling 의 terminal 의미 회귀망(§13.3 / §14.2).
 *
 * 종전 `useEqpLifecycleCommands.waitForEqpAsyncCompletion` 은 `TIMEOUT` 을 `FAIL` 과 함께 던졌고,
 * 조회 횟수를 소진하면 그것도 `throw` 했다. 백엔드는 이제 `TIMEOUT` terminal 을 만들지 않으며
 * (지연은 `phase=RECONCILING`), 늦게 도착한 적용이 실제 결과로 수렴한다. 그래서 front 가
 * 지연을 실패로 확정하면 **실제로는 성공한 변경을 실패로 보고**하게 된다.
 *
 * 여기서 고정하는 것:
 * 1. `PASS` / `FAIL` / `REPAIR_REQUIRED` 만 terminal.
 * 2. `TIMEOUT` 과 모르는 status 는 terminal 이 아니다 — 계속 조회한다.
 * 3. 조회 소진은 `DELAYED` 이고 예외가 아니다.
 * 4. `503`(원장 일시 조회 불가)은 조회를 계속한다. `404`(operation 미존재)는 올린다.
 */

const buildStatus = (overrides: Partial<OperationStatus>): OperationStatus => ({
  operationId: 'op-1',
  eqpId: 'EQP-1',
  status: 'PENDING',
  phase: 'PREPARING',
  desiredRevision: null,
  startedAt: null,
  updatedAt: null,
  terminalAt: null,
  errorCode: null,
  errorMsg: null,
  repairReason: null,
  ...overrides,
})

/** 테스트는 타이머 없이 돈다 — 대기 호출 횟수만 센다. */
const createWaitCounter = () => {
  let calls = 0
  return {
    wait: async () => {
      calls += 1
    },
    get calls() {
      return calls
    },
  }
}

const pollWith = (
  statuses: ReadonlyArray<OperationStatus | Error>,
  maxAttempts: number,
) => {
  const waiter = createWaitCounter()
  let index = 0
  const promise = pollOperationUntilTerminal({
    fetchStatus: async () => {
      const next = statuses[Math.min(index, statuses.length - 1)]
      index += 1
      if (next instanceof Error) {
        throw next
      }
      return next
    },
    operationId: 'op-1',
    intervalMs: 1,
    maxAttempts,
    onProgress: () => {},
    wait: waiter.wait,
  })
  return { promise, waiter, attempts: () => index }
}

test('terminal 판정은 PASS / FAIL / REPAIR_REQUIRED 뿐이다', () => {
  assert.equal(isTerminalOperationState('PASS'), true)
  assert.equal(isTerminalOperationState('FAIL'), true)
  assert.equal(isTerminalOperationState('REPAIR_REQUIRED'), true)

  assert.equal(isTerminalOperationState('PENDING'), false)
  // §14.2 회귀 지점 — 백엔드가 더 이상 만들지 않는 값이지만, 받더라도 terminal 이면 안 된다.
  assert.equal(isTerminalOperationState('TIMEOUT'), false)
  assert.equal(isTerminalOperationState('SOMETHING_NEW'), false)
})

test('PASS 를 받으면 그 상태와 함께 즉시 끝난다', async () => {
  const { promise } = pollWith([buildStatus({ status: 'PASS', phase: 'BARRIER_OPEN' })], 10)
  const outcome = await promise

  assert.equal(outcome.kind, 'PASS')
  assert.equal(outcome.status?.phase, 'BARRIER_OPEN')
})

test('REPAIR_REQUIRED 는 FAIL 이 아니라 자기 자신으로 보고된다', async () => {
  const { promise } = pollWith(
    [
      buildStatus({
        status: 'REPAIR_REQUIRED',
        phase: 'COMPENSATING',
        repairReason: '보상이 완결되지 않았습니다.',
      }),
    ],
    10,
  )
  const outcome = await promise

  assert.equal(outcome.kind, 'REPAIR_REQUIRED')
  assert.equal(outcome.status?.repairReason, '보상이 완결되지 않았습니다.')
})

test('TIMEOUT status 는 terminal 이 아니라 계속 조회된다', async () => {
  const { promise } = pollWith(
    [buildStatus({ status: 'TIMEOUT' }), buildStatus({ status: 'PASS' })],
    10,
  )
  const outcome = await promise

  assert.equal(outcome.kind, 'PASS', 'TIMEOUT 뒤 도착한 PASS 가 실제 결과여야 한다')
})

test('모르는 status 도 성공·실패로 추정하지 않고 계속 조회한다', async () => {
  const { promise } = pollWith(
    [buildStatus({ status: 'SOMETHING_NEW' }), buildStatus({ status: 'FAIL', errorMsg: 'x' })],
    10,
  )
  const outcome = await promise

  assert.equal(outcome.kind, 'FAIL')
  assert.equal(outcome.status?.errorMsg, 'x')
})

test('조회 횟수를 소진해도 FAIL 이 아니라 DELAYED 다', async () => {
  const { promise, waiter } = pollWith([buildStatus({ phase: 'RECONCILING' })], 3)
  const outcome = await promise

  assert.equal(outcome.kind, 'DELAYED', '소진은 실패가 아니다(§14.2)')
  assert.equal(outcome.status?.operationId, 'op-1', '재조회용 operationId 가 남아야 한다')
  assert.equal(waiter.calls, 3, 'maxAttempts 만큼만 대기한다')
})

test('503 은 조회를 이어가고 404 는 호출부로 올린다', async () => {
  const unavailable = new ApiError(
    createFailResponse(
      {
        success: false,
        data: null,
        errorCode: 'COORDINATION_UNAVAILABLE',
        errorMsg: 'unavailable',
      },
      'unavailable',
    ),
    503,
  )

  const { promise } = pollWith([unavailable, buildStatus({ status: 'PASS' })], 10)
  assert.equal((await promise).kind, 'PASS', '503 한 번으로 작업을 실패시키면 안 된다')

  const notFound = new ApiError(
    createFailResponse(
      { success: false, data: null, errorCode: 'NOT_FOUND', errorMsg: 'missing' },
      'missing',
    ),
    404,
  )

  const { promise: missingPromise } = pollWith([notFound], 10)
  await assert.rejects(
    () => missingPromise,
    (error: unknown) => error instanceof ApiError && error.status === 404,
  )
})
