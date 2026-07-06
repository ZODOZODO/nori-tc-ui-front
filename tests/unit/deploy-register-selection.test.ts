import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_DEPLOY_TARGETS_PER_REQUEST,
  resolveInterfaceType,
  willExceedMaxTargets,
} from '@/features/deploy/lib/deploy-register-selection.ts'
import type { DeployRegisterTargetItem } from '@/features/deploy/types/deploy.types.ts'

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

test('상한 상수는 BE max-targets-per-request 기본값(100)과 일치합니다', () => {
  assert.equal(MAX_DEPLOY_TARGETS_PER_REQUEST, 100)
})

test('현재+추가 개수가 상한 이하이면 초과로 판정하지 않습니다', () => {
  assert.equal(willExceedMaxTargets(0, MAX_DEPLOY_TARGETS_PER_REQUEST), false)
  assert.equal(willExceedMaxTargets(MAX_DEPLOY_TARGETS_PER_REQUEST - 1, 1), false)
  // 배포 진입 검증(newlyAddedCount=0): 정확히 상한이면 통과
  assert.equal(willExceedMaxTargets(MAX_DEPLOY_TARGETS_PER_REQUEST, 0), false)
})

test('현재+추가 개수가 상한을 넘으면 초과로 판정합니다', () => {
  assert.equal(willExceedMaxTargets(MAX_DEPLOY_TARGETS_PER_REQUEST, 1), true)
  assert.equal(willExceedMaxTargets(60, 41), true)
  // 배포 진입 검증(newlyAddedCount=0): 이미 상한 초과 상태
  assert.equal(willExceedMaxTargets(MAX_DEPLOY_TARGETS_PER_REQUEST + 1, 0), true)
})
