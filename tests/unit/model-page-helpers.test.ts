import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectCascadeDeletedVersionKeys,
  collectModelVersionKeysByModelKeys,
  isDeprecatedStatus,
  mergeSelectedModelIntoList,
  resolveDetailNodesByInterface,
  resolveLatestModelByName,
  sortByUpdatedAtDesc,
  sortDetailRowsByFirstColumn,
} from '@/features/model/lib/model-page-helpers.ts'
import type { ModelDetailRow, ModelInfo, ProtocolType } from '@/features/model/types/model.types.ts'

/**
 * ModelPage 헬퍼의 행동 고정.
 *
 * 이 헬퍼들은 ModelPage.tsx 안에 있어 단위 검증이 불가했고, 사이드바 트리 조작을 거치는
 * model e2e 는 wm-parity 개편으로 진입 경로가 stale 해 로컬에서 사전 실패한다(44 중 37).
 * 즉 삭제 파급 수집 / 3 모드 노드 분기에 실행 가능한 게이트가 없었다 — lib 로 분리한 뒤
 * 그 구멍을 여기서 막는다.
 */

const model = (overrides: Partial<ModelInfo>): ModelInfo => ({
  modelVersionKey: 1,
  modelKey: 1,
  modelName: 'MODEL',
  parentModel: null,
  modelVersion: 'V1',
  commInterface: 'SECS',
  status: 'ACTIVE',
  description: null,
  maker: null,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
  ...overrides,
})

const row = (id: string, values: string[]): ModelDetailRow => ({ id, values, previewValues: [] })

test('resolveDetailNodesByInterface: SECS / SOCKET / PLC 3 모드가 각자의 노드 집합을 받는다', () => {
  const secsNodes = resolveDetailNodesByInterface('SECS')
  const socketNodes = resolveDetailNodesByInterface('SOCKET')
  const plcNodes = resolveDetailNodesByInterface('PLC')

  assert.ok(secsNodes.includes('secs-message'), 'SECS 는 secs-message 를 가져야 함')
  assert.ok(socketNodes.includes('socket-message'), 'SOCKET 은 socket-message 를 가져야 함')
  assert.ok(plcNodes.includes('plc-group'), 'PLC 는 plc-group 을 가져야 함')

  // 세 모드가 서로 다른 집합이어야 한다 — 같으면 탭이 남의 노드를 그린다.
  assert.notDeepEqual(secsNodes, socketNodes)
  assert.notDeepEqual(socketNodes, plcNodes)
})

test('resolveDetailNodesByInterface: 소문자 인터페이스도 정규화해 같은 집합을 준다', () => {
  // 정규화가 빠지면 소문자 값이 전부 SECS fallback 으로 떨어져 SOCKET / PLC 탭이 잘못 그려진다.
  assert.deepEqual(
    resolveDetailNodesByInterface('socket' as ProtocolType),
    resolveDetailNodesByInterface('SOCKET'),
  )
  assert.deepEqual(
    resolveDetailNodesByInterface('plc' as ProtocolType),
    resolveDetailNodesByInterface('PLC'),
  )
})

test('collectCascadeDeletedVersionKeys: root 삭제 시 branch version key 까지 함께 수집한다', () => {
  const modelItems = [
    model({ modelVersionKey: 10, modelKey: 1, modelName: 'ROOT' }),
    model({ modelVersionKey: 11, modelKey: 1, modelName: 'ROOT' }),
    model({ modelVersionKey: 20, modelKey: 2, modelName: 'ROOT_admin', parentModel: 'ROOT' }),
    model({ modelVersionKey: 30, modelKey: 3, modelName: 'OTHER' }),
  ]

  const removed = collectCascadeDeletedVersionKeys(modelItems, 'ROOT')

  // parentModel 조건이 빠지면 20 이 누락돼 이미 사라진 branch 가 화면에 유령으로 남는다.
  assert.deepEqual(removed.sort((a, b) => a - b), [10, 11, 20])
})

test('collectModelVersionKeysByModelKeys: 지정한 modelKey 의 version key 만 모은다', () => {
  const modelItems = [
    model({ modelVersionKey: 10, modelKey: 1 }),
    model({ modelVersionKey: 11, modelKey: 1 }),
    model({ modelVersionKey: 20, modelKey: 2 }),
    model({ modelVersionKey: 30, modelKey: 3 }),
  ]

  assert.deepEqual(collectModelVersionKeysByModelKeys(modelItems, [1, 3]), [10, 11, 30])
  assert.deepEqual(collectModelVersionKeysByModelKeys(modelItems, []), [])
})

test('resolveLatestModelByName: 동명 버전 중 updatedAt 최신을 고르고 이름이 없으면 null 이다', () => {
  const modelItems = [
    model({ modelVersionKey: 10, modelName: 'ROOT', updatedAt: '2026-08-01T00:00:00Z' }),
    model({ modelVersionKey: 12, modelName: 'ROOT', updatedAt: '2026-08-03T00:00:00Z' }),
    model({ modelVersionKey: 11, modelName: 'ROOT', updatedAt: '2026-08-02T00:00:00Z' }),
    model({ modelVersionKey: 20, modelName: 'OTHER', updatedAt: '2026-08-09T00:00:00Z' }),
  ]

  assert.equal(resolveLatestModelByName(modelItems, 'ROOT')?.modelVersionKey, 12)
  assert.equal(resolveLatestModelByName(modelItems, null), null)
  assert.equal(resolveLatestModelByName(modelItems, 'MISSING'), null)
})

test('sortByUpdatedAtDesc: 최신순으로 정렬하고 입력 배열을 변형하지 않는다', () => {
  const modelItems = [
    model({ modelVersionKey: 1, updatedAt: '2026-08-01T00:00:00Z' }),
    model({ modelVersionKey: 3, updatedAt: '2026-08-03T00:00:00Z' }),
    model({ modelVersionKey: 2, updatedAt: '2026-08-02T00:00:00Z' }),
  ]

  const sorted = sortByUpdatedAtDesc(modelItems)

  assert.deepEqual(sorted.map((item) => item.modelVersionKey), [3, 2, 1])
  // in-place sort 면 React query 캐시 배열을 직접 뒤집어 리렌더가 누락된다.
  assert.deepEqual(modelItems.map((item) => item.modelVersionKey), [1, 3, 2])
})

test('sortDetailRowsByFirstColumn: 첫 컬럼 오름차순으로 정렬하고 빈 값 행도 안전하다', () => {
  const rows = [row('r1', ['B']), row('r2', []), row('r3', ['A'])]

  const sorted = sortDetailRowsByFirstColumn(rows)

  // values 가 빈 행은 '' 로 취급돼 맨 앞에 온다 — 접근이 터지지 않는 것이 요점이다.
  assert.deepEqual(sorted.map((item) => item.id), ['r2', 'r3', 'r1'])
  assert.deepEqual(rows.map((item) => item.id), ['r1', 'r2', 'r3'])
})

test('isDeprecatedStatus: 공백과 대소문자를 흡수한다', () => {
  assert.equal(isDeprecatedStatus('DEPRECATED'), true)
  assert.equal(isDeprecatedStatus('  deprecated '), true)
  assert.equal(isDeprecatedStatus('ACTIVE'), false)
  assert.equal(isDeprecatedStatus(''), false)
})

test('mergeSelectedModelIntoList: 목록에 있는 선택은 단건 상세로 교체한다', () => {
  const baseItems = [
    model({ modelVersionKey: 10, status: 'ACTIVE' }),
    model({ modelVersionKey: 11, status: 'ACTIVE' }),
  ]
  const selectedDetail = model({ modelVersionKey: 11, status: 'DEPRECATED' })

  const merged = mergeSelectedModelIntoList(baseItems, selectedDetail)

  // 교체가 빠지면 체크인 직후 상세에서 바뀐 값이 목록 표에 반영되지 않는다.
  assert.equal(merged.length, 2)
  assert.equal(merged[1].status, 'DEPRECATED')
  assert.equal(merged[0].status, 'ACTIVE')
})

test('mergeSelectedModelIntoList: 목록에 없는 선택은 맨 앞에 끼운다', () => {
  const baseItems = [model({ modelVersionKey: 10 })]
  const selectedDetail = model({ modelVersionKey: 99, modelName: 'OTHER_SCOPE' })

  const merged = mergeSelectedModelIntoList(baseItems, selectedDetail)

  // prepend 가 빠지면 다른 스코프에서 고른 선택의 버전 화면이 빈 목록으로 뜬다.
  assert.deepEqual(merged.map((item) => item.modelVersionKey), [99, 10])
})

test('mergeSelectedModelIntoList: 선택이 없으면 목록을 그대로 반환한다', () => {
  const baseItems = [model({ modelVersionKey: 10 })]

  assert.equal(mergeSelectedModelIntoList(baseItems, undefined), baseItems)
})
