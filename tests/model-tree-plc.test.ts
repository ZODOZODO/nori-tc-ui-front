import assert from 'node:assert/strict'
import test from 'node:test'
import { buildModelTreeGroups } from '../src/features/model/lib/model-tree.util.ts'
import {
  MODEL_DETAIL_NODE_LABELS,
  PLC_DETAIL_NODES,
} from '../src/features/model/types/model.types.ts'
import type { ModelInfo } from '../src/features/model/types/model.types.ts'

/**
 * plc-gateway Phase 5: model tree 의 PLC 인터페이스 분류 단위 테스트입니다.
 *
 * AC(L1354/L1355): PLC 모델은 plcRoots 에만 분류되고 SECS/Socket 그룹에는 절대 나타나지
 * 않아야 한다(오분류 음성). 컴포넌트 DOM 검증은 e2e 가 담당하고, 본 파일은 분류 helper
 * (buildModelTreeGroups)의 순수 로직을 node native test 로 고정한다(flow-sidebar-tree 답습).
 */

const makeModel = (overrides: Partial<ModelInfo> & { modelName: string; commInterface: string }): ModelInfo => ({
  modelVersionKey: overrides.modelVersionKey ?? 1,
  modelKey: overrides.modelKey ?? 1,
  modelName: overrides.modelName,
  parentModel: overrides.parentModel ?? null,
  modelVersion: overrides.modelVersion ?? '1.0.0',
  commInterface: overrides.commInterface,
  status: overrides.status ?? 'OPERATE',
  description: overrides.description ?? null,
  maker: overrides.maker ?? null,
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00Z',
  createdBy: overrides.createdBy ?? 'system',
  updatedBy: overrides.updatedBy ?? 'system',
})

test('buildModelTreeGroups: PLC 모델은 plcRoots 에만 분류된다', () => {
  const groups = buildModelTreeGroups(
    [makeModel({ modelName: 'PLC_MODEL_A', commInterface: 'PLC', modelVersionKey: 10, modelKey: 10 })],
    '',
  )

  assert.equal(groups.plcRoots.length, 1)
  assert.equal(groups.plcRoots[0].representative.modelName, 'PLC_MODEL_A')
})

test('buildModelTreeGroups: PLC 모델은 secsRoots/socketRoots 에 나타나지 않는다 (오분류 음성)', () => {
  const groups = buildModelTreeGroups(
    [makeModel({ modelName: 'PLC_MODEL_A', commInterface: 'PLC', modelVersionKey: 10, modelKey: 10 })],
    '',
  )

  assert.equal(groups.secsRoots.length, 0, 'PLC 모델이 SECS 그룹에 오분류됨')
  assert.equal(groups.socketRoots.length, 0, 'PLC 모델이 Socket 그룹에 오분류됨')
})

test('buildModelTreeGroups: SECS/Socket/PLC 가 섞여도 각자 그룹으로만 분류된다 (무회귀)', () => {
  const groups = buildModelTreeGroups(
    [
      makeModel({ modelName: 'SECS_MODEL', commInterface: 'SECS', modelVersionKey: 1, modelKey: 1 }),
      makeModel({ modelName: 'SOCKET_MODEL', commInterface: 'SOCKET', modelVersionKey: 2, modelKey: 2 }),
      makeModel({ modelName: 'PLC_MODEL', commInterface: 'PLC', modelVersionKey: 3, modelKey: 3 }),
    ],
    '',
  )

  assert.deepEqual(
    groups.secsRoots.map((node) => node.representative.modelName),
    ['SECS_MODEL'],
  )
  assert.deepEqual(
    groups.socketRoots.map((node) => node.representative.modelName),
    ['SOCKET_MODEL'],
  )
  assert.deepEqual(
    groups.plcRoots.map((node) => node.representative.modelName),
    ['PLC_MODEL'],
  )
})

test('buildModelTreeGroups: 소문자 plc commInterface 도 plcRoots 로 정규화 분류된다', () => {
  const groups = buildModelTreeGroups(
    [makeModel({ modelName: 'PLC_LOWER', commInterface: 'plc', modelVersionKey: 4, modelKey: 4 })],
    '',
  )

  assert.equal(groups.plcRoots.length, 1)
  assert.equal(groups.secsRoots.length, 0)
})

test('PLC_DETAIL_NODES: plc-group/plc-register 노드를 라벨과 함께 노출한다', () => {
  assert.deepEqual(PLC_DETAIL_NODES, ['plc-group', 'plc-register'])
  assert.equal(MODEL_DETAIL_NODE_LABELS['plc-group'], 'PLC Group')
  assert.equal(MODEL_DETAIL_NODE_LABELS['plc-register'], 'PLC Register')
})
