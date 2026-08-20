import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCheckInDiffSections,
  computeNodeDiff,
} from '@/features/model/lib/model-diff.util.ts'
import type { ModelDetailRow } from '@/features/model/types/model.types.ts'

/**
 * plc-model-fix D2: check-in diff 의 노드별 identity 단위 테스트입니다.
 *
 * plc-register 의 col0(Group)은 비고유라, identity 를 values[0] 만으로 잡으면 같은 그룹의 레지스터가
 * Map 에서 last-one-wins 로 붕괴해 diff 가 그룹당 1행으로 뭉개진다(사용자 보고: "diff 내용이 달라").
 * computeNodeDiff 가 plc-register 를 (Group, Variable Name) 복합키로 식별해 붕괴가 없음을 고정한다.
 */

const row = (id: string, values: string[]): ModelDetailRow => ({ id, values, previewValues: [] })

// plc-register 13컬럼: [Group, Word Offset, Variable Name, Data Type, ...]
const register = (id: string, group: string, wordOffset: string, variableName: string): ModelDetailRow =>
  row(id, [group, wordOffset, variableName, 'UINT16', '', '', '', '', '', '', '', '', ''])

test('computeNodeDiff(plc-register): 같은 그룹의 레지스터가 붕괴하지 않고 추가가 변수별로 잡힌다', () => {
  const current = [
    register('plcregister:401', 'POLL_A', '0', 'VAR_1'),
    register('plcregister:402', 'POLL_A', '1', 'VAR_2'),
  ]
  const previous = [register('plcregister:301', 'POLL_A', '0', 'VAR_1')]

  const diff = computeNodeDiff('plc-register', current, previous)

  assert.equal(diff.added.length, 1, '같은 그룹의 두 레지스터 중 신규 1건만 added 여야 함(그룹 붕괴 시 0)')
  assert.equal(diff.added[0].identity, 'POLL_A|VAR_2')
  assert.equal(diff.changed.length, 0)
  assert.equal(diff.deleted.length, 0)
})

test('computeNodeDiff(plc-register): 같은 그룹 내 특정 레지스터 변경이 변수 단위로 감지된다', () => {
  const current = [
    register('plcregister:401', 'POLL_A', '0', 'VAR_1'),
    register('plcregister:402', 'POLL_A', '5', 'VAR_2'), // wordOffset 1 -> 5
  ]
  const previous = [
    register('plcregister:301', 'POLL_A', '0', 'VAR_1'),
    register('plcregister:302', 'POLL_A', '1', 'VAR_2'),
  ]

  const diff = computeNodeDiff('plc-register', current, previous)

  assert.equal(diff.changed.length, 1, 'VAR_2 만 변경되어야 함(그룹 단위 붕괴면 식별 불가)')
  assert.equal(diff.changed[0].identity, 'POLL_A|VAR_2')
  assert.equal(diff.added.length, 0)
  assert.equal(diff.deleted.length, 0)
})

test('computeNodeDiff(model-parameter): col0 고유 노드는 values[0] 식별자를 유지한다(무회귀)', () => {
  const current = [row('param:1', ['SITE', 'NEW', 'desc']), row('param:2', ['ADDED', 'Y', ''])]
  const previous = [row('param:1', ['SITE', 'OLD', 'desc'])]

  const diff = computeNodeDiff('model-parameter', current, previous)

  assert.equal(diff.changed.length, 1)
  assert.equal(diff.changed[0].identity, 'SITE')
  assert.equal(diff.added.length, 1)
  assert.equal(diff.added[0].identity, 'ADDED')
})

const nodeDetail = (columns: string[], rows: ModelDetailRow[]) => ({
  columns,
  rows,
  mdfContents: [],
})

test('buildCheckInDiffSections: 변경이 없는 노드는 섹션에서 제외한다', () => {
  const unchanged = [row('param:1', ['SITE', 'SAME', ''])]

  const sections = buildCheckInDiffSections([
    {
      node: 'model-parameter',
      currentData: nodeDetail(['Name', 'Value', 'Desc'], unchanged),
      previousData: nodeDetail(['Name', 'Value', 'Desc'], unchanged),
    },
    {
      node: 'mes-message',
      currentData: nodeDetail(['Name'], [row('mes:1', ['NEW_MSG'])]),
      previousData: nodeDetail(['Name'], []),
    },
  ])

  // 변경 없는 노드까지 남기면 모달이 빈 섹션으로 도배된다.
  assert.equal(sections.length, 1)
  assert.equal(sections[0].detailNode, 'mes-message')
  assert.equal(sections[0].added.length, 1)
})

test('buildCheckInDiffSections: 현재 버전 컬럼이 비면 이전 버전 컬럼으로 대체한다', () => {
  // EDIT 에서 row 를 전부 지우면 서버가 columns 를 빈 배열로 준다 — 그대로 쓰면 삭제분만
  // 있는 섹션의 표 머리가 사라진다.
  const sections = buildCheckInDiffSections([
    {
      node: 'model-parameter',
      currentData: nodeDetail([], []),
      previousData: nodeDetail(['Name', 'Value', 'Desc'], [row('param:1', ['SITE', 'OLD', ''])]),
    },
  ])

  assert.equal(sections.length, 1)
  assert.deepEqual(sections[0].columns, ['Name', 'Value', 'Desc'])
  assert.equal(sections[0].deleted.length, 1)
})

test('buildCheckInDiffSections: 노드가 하나도 없으면 빈 배열이다', () => {
  assert.deepEqual(buildCheckInDiffSections([]), [])
})
