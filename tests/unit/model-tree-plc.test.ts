import assert from 'node:assert/strict'
import test from 'node:test'
import { buildModelTreeGroups } from '@/features/model/lib/model-tree.util.ts'
import {
  MODEL_DETAIL_NODE_LABELS,
  PLC_DETAIL_NODES,
  isValidPlcGroupMessageName,
} from '@/features/model/types/model.types.ts'
import type { ModelInfo } from '@/features/model/types/model.types.ts'

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

test('PLC_DETAIL_NODES: PLC 전용 노드 + 공통 노드(파라미터/MES/MDF/DCOP)를 라벨과 함께 노출한다', () => {
  assert.deepEqual(PLC_DETAIL_NODES, [
    'model-parameter',
    'plc-group',
    'plc-register',
    'mes-message',
    'mdf',
    'dcop-itemes',
  ])
  assert.equal(MODEL_DETAIL_NODE_LABELS['plc-group'], 'PLC Group')
  assert.equal(MODEL_DETAIL_NODE_LABELS['plc-register'], 'PLC Register')
  assert.equal(MODEL_DETAIL_NODE_LABELS['mdf'], 'MDF')
})

test('isValidPlcGroupMessageName: UPPER_SNAKE_CASE 만 허용한다 (Kafka eventType 네이밍)', () => {
  // 유효 — Business KafkaEventTypeNamingPolicy(DEFAULT_EVENT_TYPE_PATTERN) 통과 형식
  assert.equal(isValidPlcGroupMessageName('STATUS_REPORT'), true)
  assert.equal(isValidPlcGroupMessageName('EQP_STATUS_REPORT'), true)
  assert.equal(isValidPlcGroupMessageName('STATUS'), true)
  assert.equal(isValidPlcGroupMessageName('S6F11'), true)
  assert.equal(isValidPlcGroupMessageName('  STATUS_REPORT  '), true) // 트림 후 검사

  // 무효 — Business 가 INVALID_EVENT_TYPE 로 거부해 폴링 메시지를 drop 하는 형식
  assert.equal(isValidPlcGroupMessageName('status_report'), false) // 소문자 시작
  assert.equal(isValidPlcGroupMessageName('Status_Report'), false) // 대소문자 혼합
  assert.equal(isValidPlcGroupMessageName('STATUS-REPORT'), false) // 하이픈
  assert.equal(isValidPlcGroupMessageName('STATUS REPORT'), false) // 공백
  assert.equal(isValidPlcGroupMessageName('1STATUS'), false) // 숫자 시작
  assert.equal(isValidPlcGroupMessageName('STATUS__REPORT'), false) // 연속 언더스코어
  assert.equal(isValidPlcGroupMessageName('STATUS_'), false) // 끝 언더스코어
  assert.equal(isValidPlcGroupMessageName(''), false) // 빈값
})
