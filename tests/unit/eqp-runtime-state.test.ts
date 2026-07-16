import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resolveEquipmentVisualState,
  resolveLifecycleCommandVisibility,
} from '@/features/eqp/utils/eqp-runtime-state.util.ts'
import type { EqpInfo } from '@/features/eqp/types/eqp.types.ts'

const baseEqp: EqpInfo = {
  eqpKey: 1,
  eqpId: 'CMP_DEMO_01',
  commInterface: 'SOCKET',
  commMode: 'ACTIVE',
  isDev: true,
  routePartition: 0,
  eqpIp: '127.0.0.1',
  eqpPort: 10001,
  modelVersionKey: 1,
  enabled: true,
  createdAt: '2026-04-22T00:00:00Z',
  updatedAt: '2026-04-22T00:00:00Z',
  createdBy: 'SYSTEM',
  updatedBy: 'SYSTEM',
}

test('설비 상태 색상은 controlState와 eqpState 조합으로 결정된다', () => {
  assert.equal(resolveEquipmentVisualState(null), 'offline')
  assert.equal(resolveEquipmentVisualState({ controlState: 'OFFLINE', eqpState: 'RUN', connectionState: 'CONNECTED', desiredState: 'ENDED' }), 'offline')
  assert.equal(resolveEquipmentVisualState({ controlState: 'REMOTE', eqpState: null, connectionState: null, desiredState: 'STARTED' }), 'attention')
  assert.equal(resolveEquipmentVisualState({ controlState: 'REMOTE', eqpState: 'SERVICE_UNAVAILABLE', connectionState: null, desiredState: 'STARTED' }), 'attention')
  assert.equal(resolveEquipmentVisualState({ controlState: 'REMOTE', eqpState: 'IDLE', connectionState: null, desiredState: 'STARTED' }), 'idle')
  assert.equal(resolveEquipmentVisualState({ controlState: 'LOCAL', eqpState: 'IDLE', connectionState: null, desiredState: 'STARTED' }), 'idle')
  assert.equal(resolveEquipmentVisualState({ controlState: 'REMOTE', eqpState: 'RUN', connectionState: null, desiredState: 'STARTED' }), 'run')
})

test('AC-C4: stuck(desired=STARTED+끊김)은 정상-ended(desired=ENDED+끊김)와 다른 시각 상태를 반환한다', () => {
  const stuck = resolveEquipmentVisualState({ controlState: 'OFFLINE', eqpState: 'IDLE', connectionState: null, desiredState: 'STARTED' })
  const normalEnded = resolveEquipmentVisualState({ controlState: 'OFFLINE', eqpState: 'IDLE', connectionState: null, desiredState: 'ENDED' })
  assert.equal(stuck, 'attention')
  assert.equal(normalEnded, 'offline')
  assert.notEqual(stuck, normalEnded)
})

test('lifecycle 명령은 ACTIVE 설비의 연결 상태에 맞춰 노출된다', () => {
  assert.deepEqual(
    resolveLifecycleCommandVisibility(baseEqp, { controlState: 'OFFLINE', eqpState: 'DOWN', connectionState: null, desiredState: 'ENDED' }),
    { canStart: true, canEnd: false, canRestart: false, canReconnect: false },
  )
  assert.deepEqual(
    resolveLifecycleCommandVisibility(baseEqp, { controlState: 'REMOTE', eqpState: 'IDLE', connectionState: null, desiredState: 'STARTED' }),
    { canStart: false, canEnd: true, canRestart: true, canReconnect: false },
  )
  assert.deepEqual(
    resolveLifecycleCommandVisibility({ ...baseEqp, commMode: 'PASSIVE' }, { controlState: 'REMOTE', eqpState: 'IDLE', connectionState: null, desiredState: 'STARTED' }),
    { canStart: false, canEnd: false, canRestart: false, canReconnect: false },
  )
})

test('AC-B3: desired×control matrix 4케이스 — stuck 은 reconnect 가능·start 불가', () => {
  // 끊김 + ENDED → start
  assert.deepEqual(
    resolveLifecycleCommandVisibility(baseEqp, { controlState: 'OFFLINE', eqpState: 'DOWN', connectionState: null, desiredState: 'ENDED' }),
    { canStart: true, canEnd: false, canRestart: false, canReconnect: false },
  )
  // 끊김 + STARTED(stuck) → reconnect (start 불가)
  assert.deepEqual(
    resolveLifecycleCommandVisibility(baseEqp, { controlState: 'OFFLINE', eqpState: 'DOWN', connectionState: null, desiredState: 'STARTED' }),
    { canStart: false, canEnd: true, canRestart: false, canReconnect: true },
  )
  // 연결됨 + STARTED → end / restart
  assert.deepEqual(
    resolveLifecycleCommandVisibility(baseEqp, { controlState: 'REMOTE', eqpState: 'RUN', connectionState: null, desiredState: 'STARTED' }),
    { canStart: false, canEnd: true, canRestart: true, canReconnect: false },
  )
  // 연결됨 + ENDED → end / restart (control 연결이면 가능)
  assert.deepEqual(
    resolveLifecycleCommandVisibility(baseEqp, { controlState: 'REMOTE', eqpState: 'RUN', connectionState: null, desiredState: 'ENDED' }),
    { canStart: false, canEnd: true, canRestart: true, canReconnect: false },
  )
})
