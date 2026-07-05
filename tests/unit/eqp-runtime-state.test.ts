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
  assert.equal(resolveEquipmentVisualState({ controlState: 'OFFLINE', eqpState: 'RUN', connectionState: 'CONNECTED' }), 'offline')
  assert.equal(resolveEquipmentVisualState({ controlState: 'REMOTE', eqpState: null, connectionState: null }), 'attention')
  assert.equal(resolveEquipmentVisualState({ controlState: 'REMOTE', eqpState: 'SERVICE_UNAVAILABLE', connectionState: null }), 'attention')
  assert.equal(resolveEquipmentVisualState({ controlState: 'REMOTE', eqpState: 'IDLE', connectionState: null }), 'idle')
  assert.equal(resolveEquipmentVisualState({ controlState: 'LOCAL', eqpState: 'IDLE', connectionState: null }), 'idle')
  assert.equal(resolveEquipmentVisualState({ controlState: 'REMOTE', eqpState: 'RUN', connectionState: null }), 'run')
})

test('lifecycle 명령은 ACTIVE 설비의 연결 상태에 맞춰 노출된다', () => {
  assert.deepEqual(
    resolveLifecycleCommandVisibility(baseEqp, { controlState: 'OFFLINE', eqpState: 'DOWN', connectionState: null }),
    { canStart: true, canEnd: false, canRestart: false },
  )
  assert.deepEqual(
    resolveLifecycleCommandVisibility(baseEqp, { controlState: 'REMOTE', eqpState: 'IDLE', connectionState: null }),
    { canStart: false, canEnd: true, canRestart: true },
  )
  assert.deepEqual(
    resolveLifecycleCommandVisibility({ ...baseEqp, commMode: 'PASSIVE' }, { controlState: 'REMOTE', eqpState: 'IDLE', connectionState: null }),
    { canStart: false, canEnd: false, canRestart: false },
  )
})
