import assert from 'node:assert/strict'
import test from 'node:test'
import {
  moveSelectionToRight,
  removeFromRightArray,
  toggleSelection,
} from '../src/features/model/hooks/useDcopItemPickerState.ts'

/**
 * {@link useDcopItemPickerState} 의 pure state transformer 들에 대한 단위 테스트입니다.
 *
 * workspace 인프라 (node:test + experimental-strip-types) 는 jsdom / RTL 미설치라
 * React hook 자체를 mount 할 수 없으므로, hook 내부의 핵심 로직을 export 된 pure
 * 함수로 분리해 단위 테스트합니다. hook 의 useCallback wiring 자체는 DOM 동작을
 * 검증하는 Playwright e2e 시나리오 (AC F2) 에 위임.
 *
 * AC F3 의 "props round-trip / → 버튼 / Trash / Save callback / 매핑됨 disabled"
 * 시나리오를 transformer 레벨에서 1:1 답습합니다.
 */

test('toggleSelection: 빈 set 에 키 추가하면 1 원소 set 이 반환된다', () => {
  const result = toggleSelection(new Set(), 7)
  assert.deepEqual([...result], [7])
})

test('toggleSelection: 같은 키를 두 번 호출하면 set 이 다시 비워진다', () => {
  const first = toggleSelection(new Set(), 7)
  const second = toggleSelection(first, 7)
  assert.equal(second.size, 0)
})

test('toggleSelection: 입력 set 은 변경되지 않는다 (pure)', () => {
  const original = new Set([1, 2])
  toggleSelection(original, 3)
  assert.deepEqual([...original].sort(), [1, 2])
})

test('moveSelectionToRight: 좌측 선택을 우측에 append 한다 (insertion order)', () => {
  // Set insertion order — JavaScript 사양으로 보장.
  const left = new Set<number>([10, 20])
  const next = moveSelectionToRight([], left)
  assert.deepEqual([...next], [10, 20])
})

test('moveSelectionToRight: 우측에 이미 있는 키는 중복 추가하지 않는다', () => {
  const left = new Set<number>([10, 20])
  const next = moveSelectionToRight([10], left)
  // 10 은 그대로, 20 만 새로.
  assert.deepEqual([...next], [10, 20])
})

test('moveSelectionToRight: 좌측 빈 selection 은 우측 참조를 그대로 반환한다 (memo 친화)', () => {
  const previousRight = [5, 6]
  const next = moveSelectionToRight(previousRight, new Set())
  assert.equal(next, previousRight)
})

test('moveSelectionToRight: 좌측 모두 이미 우측에 있을 때도 동일 참조 반환', () => {
  const previousRight = [10, 20]
  const next = moveSelectionToRight(previousRight, new Set([10, 20]))
  // 새로 append 할 키가 없으므로 참조 보존.
  assert.equal(next, previousRight)
})

test('removeFromRightArray: 존재하는 키를 제거한다', () => {
  const result = removeFromRightArray([10, 20, 30], 20)
  assert.deepEqual([...result], [10, 30])
})

test('removeFromRightArray: 우측에 없는 키 호출 시 동일 참조 반환', () => {
  const previousRight = [10]
  const result = removeFromRightArray(previousRight, 99)
  assert.equal(result, previousRight)
})

test('Save callback 시나리오: 좌측 2 체크 → → → 우측 2 행 → 1 행 Trash → Save 인자 = [1 원소]', () => {
  // AC F2 의 Playwright 시나리오를 pure transformer 로 압축 재현.
  // 좌측 빈 picker — 2 개 체크.
  let left = toggleSelection(new Set(), 101)
  left = toggleSelection(left, 202)
  // → 클릭.
  let right = moveSelectionToRight([], left)
  // Trash 클릭으로 1 행 제거.
  right = removeFromRightArray(right, 101)
  // Save 가 받을 next array — 1 원소.
  assert.equal(right.length, 1)
  assert.equal(right[0], 202)
})

test('round-trip 시나리오: 매핑됨 disabled 우회해도 우측 중복 추가는 차단된다', () => {
  // 모달 UI 가 disabled 로 막는 행을 사용자가 우회해 toggle 했다 가정.
  const initialRight = [42]
  const left = toggleSelection(new Set(), 42)
  const next = moveSelectionToRight(initialRight, left)
  // 우측 array 는 1 원소 유지 — 모달 round-trip 후 재오픈 시에도 동일.
  assert.deepEqual([...next], [42])
})
