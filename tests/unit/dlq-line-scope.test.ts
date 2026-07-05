import assert from 'node:assert/strict'
import test from 'node:test'
import { filterDlqEntriesByLine } from '@/features/dlq/lib/dlq-line-scope.ts'
import type { DlqLineScope } from '@/features/dlq/lib/dlq-line-scope.ts'

interface FakeEntry {
  dlqId: string
  eqpId: string | null
}

const entries: FakeEntry[] = [
  { dlqId: 'd1', eqpId: 'EQ_LINE1' },
  { dlqId: 'd2', eqpId: 'EQ_LINE2' },
  { dlqId: 'd3', eqpId: null },
  { dlqId: 'd4', eqpId: 'EQ_UNKNOWN' },
]

const scope: DlqLineScope = {
  selectedLineKey: 1,
  lineKeyByEqpId: new Map([
    ['EQ_LINE1', 1],
    ['EQ_LINE2', 2],
  ]),
}

const resolveEqpId = (entry: FakeEntry) => entry.eqpId

test('선택 라인 소속 설비의 항목만 통과한다', () => {
  const result = filterDlqEntriesByLine(entries, resolveEqpId, scope)

  assert.ok(result.some((entry) => entry.dlqId === 'd1'))
  assert.ok(!result.some((entry) => entry.dlqId === 'd2'))
})

test('eqpId 가 없거나 설비 목록에 없는 항목은 어느 라인에서도 표시된다', () => {
  const line1Result = filterDlqEntriesByLine(entries, resolveEqpId, scope)
  const line2Result = filterDlqEntriesByLine(entries, resolveEqpId, {
    ...scope,
    selectedLineKey: 2,
  })

  for (const result of [line1Result, line2Result]) {
    assert.ok(result.some((entry) => entry.dlqId === 'd3'))
    assert.ok(result.some((entry) => entry.dlqId === 'd4'))
  }
})

test('selectedLineKey 미해석(null)이면 빈 목록을 반환한다', () => {
  const result = filterDlqEntriesByLine(entries, resolveEqpId, {
    ...scope,
    selectedLineKey: null,
  })

  assert.deepEqual(result, [])
})

test('입력 배열을 변경하지 않는다', () => {
  const snapshot = [...entries]
  filterDlqEntriesByLine(entries, resolveEqpId, scope)

  assert.deepEqual(entries, snapshot)
})
