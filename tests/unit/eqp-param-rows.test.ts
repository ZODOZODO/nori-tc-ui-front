import assert from 'node:assert/strict'
import test from 'node:test'
import { computeEqpParamDiffRows } from '@/features/eqp/lib/eqp-param-rows.ts'

/**
 * Check In diff 계산의 행동 고정.
 *
 * 이 로직은 EqpPage.tsx 안에 있어 단위 검증이 불가했고, CheckInModal diff 를 확인하는 e2e
 * (selectable-table-check-in.spec.ts:307 / :340) 는 클립보드 권한 문제로 로컬에서 사전 실패한다.
 * 즉 89 줄 diff 로직에 실행 가능한 게이트가 없었다 — lib 로 분리한 뒤 그 구멍을 여기서 막는다.
 */

const row = (paramName: string, paramValue: string, description: string) => ({
  paramName,
  paramValue,
  description,
})

test('added / changed / deleted 를 상태 순서로 정렬한다', () => {
  const diff = computeEqpParamDiffRows(
    [row('B', '2', ''), row('A', '1', '')],
    [row('A', '0', ''), row('C', '3', '')],
  )

  assert.deepEqual(
    diff.map((d) => [d.status, d.paramName]),
    [
      ['added', 'B'],
      ['changed', 'A'],
      ['deleted', 'C'],
    ],
  )
})

test('같은 상태 안에서는 paramName 사전순이다', () => {
  const diff = computeEqpParamDiffRows([row('Z', '1', ''), row('A', '1', '')], [])

  assert.deepEqual(diff.map((d) => d.paramName), ['A', 'Z'])
})

test('paramName 은 trim 후 비교한다 — 공백만 다른 이름이 added+deleted 를 만들지 않는다', () => {
  // trim 이 빠지면 ' A ' added 와 'A' deleted 가 동시에 잡혀 변경 없음이 2 행으로 보고된다.
  const diff = computeEqpParamDiffRows([row('  A  ', '1', 'desc')], [row('A', '1', 'desc')])

  assert.deepEqual(diff, [])
})

test('paramName 이 공백뿐인 행은 diff 대상에서 제외한다', () => {
  const diff = computeEqpParamDiffRows([row('   ', 'x', 'y')], [row('  ', 'z', 'w')])

  assert.deepEqual(diff, [])
})

test('description 만 바뀌어도 changed 로 잡는다', () => {
  const diff = computeEqpParamDiffRows([row('A', '1', '새 설명')], [row('A', '1', '옛 설명')])

  assert.deepEqual(diff, [
    {
      status: 'changed',
      paramName: 'A',
      parentValue: '1',
      branchValue: '1',
      parentDescription: '옛 설명',
      branchDescription: '새 설명',
    },
  ])
})
