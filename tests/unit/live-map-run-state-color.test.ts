import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LIVE_MAP_STATUS_CLASS,
  resolveRunStateChipClass,
} from '@/features/live-map/lib/live-map-status-theme.ts'

// M7: CANCELED(사용자 명시 종료)도 FAILED 와 동일하게 오류색(ERROR/빨강)으로 표시한다(미완료 종료 강조).
test('CANCELED 는 FAILED 와 동일하게 오류색(ERROR)으로 매핑된다', () => {
  assert.equal(resolveRunStateChipClass('CANCELED'), LIVE_MAP_STATUS_CLASS.ERROR.chip)
})

test('FAILED 는 오류색(ERROR)으로 매핑된다', () => {
  assert.equal(resolveRunStateChipClass('FAILED'), LIVE_MAP_STATUS_CLASS.ERROR.chip)
})

test('RUNNING=RUN / COMPLETED·TERMINAL=IDLE 매핑 유지', () => {
  assert.equal(resolveRunStateChipClass('RUNNING'), LIVE_MAP_STATUS_CLASS.RUN.chip)
  assert.equal(resolveRunStateChipClass('COMPLETED'), LIVE_MAP_STATUS_CLASS.IDLE.chip)
  assert.equal(resolveRunStateChipClass('TERMINAL'), LIVE_MAP_STATUS_CLASS.IDLE.chip)
})

// Lo3: 'ERRORED' 는 백엔드 enum 에 없는 유령 값 — 더는 ERROR 로 분기하지 않고 기본 DOWN.
test('ERRORED 유령 분기 제거 — 기본 중립(DOWN)으로 흡수', () => {
  assert.equal(resolveRunStateChipClass('ERRORED'), LIVE_MAP_STATUS_CLASS.DOWN.chip)
})

test('STOPPING/CREATED/PENDING 등 그 외 상태는 중립(DOWN)', () => {
  assert.equal(resolveRunStateChipClass('STOPPING'), LIVE_MAP_STATUS_CLASS.DOWN.chip)
  assert.equal(resolveRunStateChipClass('PENDING'), LIVE_MAP_STATUS_CLASS.DOWN.chip)
})
