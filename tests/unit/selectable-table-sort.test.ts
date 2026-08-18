import assert from 'node:assert/strict'
import test from 'node:test'
import { SORT_COLLATOR } from '@/shared/components/SelectableTable/sort.ts'

test('SORT_COLLATOR 는 숫자 문자열을 자연 정렬한다 (사전순 뒤집힘 방지)', () => {
  const sorted = ['9', '10', '2'].sort(SORT_COLLATOR.compare)

  assert.deepEqual(sorted, ['2', '9', '10'])
  // 종전 비교기(localeCompare 옵션 없음)는 '10' 을 '9' 앞에 둔다 — 그 동작이면 이 단언이 깨진다.
  assert.notDeepEqual(['9', '10', '2'].sort((a, b) => a.localeCompare(b)), sorted)
})

test('SORT_COLLATOR 는 숫자 접미사를 가진 식별자도 자연 정렬한다', () => {
  const sorted = ['EQP-10', 'EQP-2', 'EQP-1'].sort(SORT_COLLATOR.compare)

  assert.deepEqual(sorted, ['EQP-1', 'EQP-2', 'EQP-10'])
})
