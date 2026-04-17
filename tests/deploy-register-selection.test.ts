import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveInterfaceType } from '../src/features/deploy/lib/deploy-register-selection.ts'
import type { DeployRegisterTargetItem } from '../src/features/deploy/types/deploy.types.ts'

const createTarget = (
  eqpId: string,
  commInterface: DeployRegisterTargetItem['commInterface'],
): DeployRegisterTargetItem => ({
  eqpKey: 1,
  eqpId,
  commInterface,
  enabled: true,
  modelVersionKey: 1,
  modelName: 'MODEL',
  modelVersion: '1.0.0',
  modelStatus: 'OPERATE',
  businessJarRef: 1,
  businessJarFileName: 'business.jar',
  appliedParamVersion: '1.0.0',
  blockedByActiveDeploy: false,
  activeDeployKey: null,
  activeDeployStatus: null,
  activeDeployName: null,
  activeRequestedBy: null,
})

test('동일한 interface 설비를 여러 대 선택하면 해당 interface를 유지합니다', () => {
  const selectedEqpTargetsById = {
    CMP_DEMO_01: createTarget('CMP_DEMO_01', 'SOCKET'),
    CVD_DEMO_01: createTarget('CVD_DEMO_01', 'SOCKET'),
  }

  assert.equal(
    resolveInterfaceType(['CMP_DEMO_01', 'CVD_DEMO_01'], selectedEqpTargetsById),
    'SOCKET',
  )
})

test('서로 다른 interface 설비를 함께 선택하면 null을 반환합니다', () => {
  const selectedEqpTargetsById = {
    CMP_DEMO_01: createTarget('CMP_DEMO_01', 'SOCKET'),
    CVD_DEMO_01: createTarget('CVD_DEMO_01', 'SECS'),
  }

  assert.equal(
    resolveInterfaceType(['CMP_DEMO_01', 'CVD_DEMO_01'], selectedEqpTargetsById),
    null,
  )
})

test('선택된 설비 중 interface 정보가 비어 있으면 null을 반환합니다', () => {
  const selectedEqpTargetsById = {
    CMP_DEMO_01: createTarget('CMP_DEMO_01', 'SOCKET'),
  }

  assert.equal(
    resolveInterfaceType(['CMP_DEMO_01', 'CVD_DEMO_01'], selectedEqpTargetsById),
    null,
  )
})
