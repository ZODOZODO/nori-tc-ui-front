import assert from 'node:assert/strict'
import test from 'node:test'
import { apiClient } from '@/shared/lib/api-client.ts'
import { deployApi } from '@/features/deploy/api/deploy.api.ts'
import { UNKNOWN_SERVER_STATUS } from '@/features/deploy/types/deploy.types.ts'
import { isFailedDeployOutcome } from '@/features/deploy/lib/deploy-register-utils.ts'
import { resolveStatusVariant } from '@/features/deploy/lib/deploy-monitor-format.ts'
import type { DeploySummary, DeployTargetItem } from '@/features/deploy/types/deploy.types.ts'

/**
 * deploy 상태 validator 의 **fallback 금지** 회귀망(§14.3).
 *
 * 종전 validator 는 모르는 status 를 `PENDING`(target) / `PLANNING`(execution) 으로 바꿨다.
 * 그 둘은 "아직 시작 전" 이라는 뜻이라, 복구가 필요하거나 이미 실패한 배포가 정상 대기처럼
 * 보였다 — 운영자가 확인할 기회를 잃는다. 이제는 `UNKNOWN_SERVER_STATUS` 로 드러내고
 * 성공·실패를 추정하지 않는다.
 *
 * 또한 protocol recovery 상태(`RECONCILING` / `FINALIZING` / `REPAIR_REQUIRED`)를 받으면
 * **그대로 보존**해야 한다 — 이 값들을 모르는 값으로 처리하면 §14.3 이 요구한 표현력이 사라진다.
 */

const withDeployTargetsResponse = async (
  targets: ReadonlyArray<Record<string, unknown>>,
  scenario: () => Promise<void>,
): Promise<void> => {
  const client = apiClient as unknown as { get: unknown }
  const originalGet = client.get

  client.get = async () => ({
    data: {
      success: true,
      data: { targets, page: 0, size: 50, totalElements: targets.length },
      errorCode: null,
      errorMsg: null,
    },
    status: 200,
  })

  try {
    await scenario()
  } finally {
    client.get = originalGet
  }
}

const targetPayload = (targetStatus: string): Record<string, unknown> => ({
  deployTargetKey: 1,
  eqpId: 'EQP-1',
  targetStatus,
  updatedAt: '2026-08-25T00:00:00Z',
})

test('모르는 target status 를 PENDING 으로 접지 않는다', async () => {
  await withDeployTargetsResponse([targetPayload('SOMETHING_THE_FRONT_DOES_NOT_KNOW')], async () => {
    const page = await deployApi.getDeployTargets(1)

    assert.equal(page.targets.length, 1)
    assert.notEqual(page.targets[0].targetStatus, 'PENDING', '초기 상태로 축약하면 안 된다')
    assert.equal(page.targets[0].targetStatus, UNKNOWN_SERVER_STATUS)
  })
})

test('protocol recovery 상태는 그대로 보존된다', async () => {
  const recoveryStatuses = ['RECONCILING', 'FINALIZING', 'REPAIR_REQUIRED'] as const

  await withDeployTargetsResponse(
    recoveryStatuses.map((status) => ({ ...targetPayload(status), deployTargetKey: 1 })),
    async () => {
      const page = await deployApi.getDeployTargets(1)

      assert.deepEqual(
        page.targets.map((target) => target.targetStatus),
        [...recoveryStatuses],
        '§14.3 이 요구한 recovery 상태를 validator 가 떨어뜨렸다',
      )
    },
  )
})

test('알 수 없는 상태는 성공 배지(default)로 그려지지 않는다', () => {
  assert.notEqual(
    resolveStatusVariant(UNKNOWN_SERVER_STATUS),
    'default',
    '모르는 상태를 정상 완료처럼 보이게 하면 안 된다',
  )
  assert.equal(resolveStatusVariant('REPAIR_REQUIRED'), 'warning')
})

const summaryWith = (deployStatus: DeploySummary['deployStatus']): DeploySummary =>
  ({
    deployStatus,
    targetSummary: {
      total: 1,
      pending: 0,
      noChange: 0,
      running: 0,
      completed: 1,
      failed: 0,
      rollingBack: 0,
      rolledBack: 0,
      compensationFailed: 0,
      canceled: 0,
    },
  }) as unknown as DeploySummary

const cleanTarget = (targetStatus: DeployTargetItem['targetStatus']): DeployTargetItem =>
  ({
    deployTargetKey: 1,
    eqpId: 'EQP-1',
    targetStatus,
    currentStepOrder: null,
    currentStepCode: null,
    currentStepStatus: null,
    rollbackRequired: false,
    lastErrorCode: null,
    lastErrorMessage: null,
    updatedAt: '2026-08-25T00:00:00Z',
  }) as DeployTargetItem

test('REPAIR_REQUIRED / 알 수 없는 상태는 정상 완료로 끝나지 않는다', () => {
  assert.equal(
    isFailedDeployOutcome(summaryWith('COMPLETED'), [cleanTarget('COMPLETED')]),
    false,
    '정상 완료는 그대로 정상이어야 한다',
  )
  assert.equal(
    isFailedDeployOutcome(summaryWith('REPAIR_REQUIRED'), [cleanTarget('COMPLETED')]),
    true,
  )
  assert.equal(
    isFailedDeployOutcome(summaryWith('COMPLETED'), [cleanTarget(UNKNOWN_SERVER_STATUS)]),
    true,
    '결과를 모르는 target 을 성공으로 보고하면 안 된다',
  )
})
