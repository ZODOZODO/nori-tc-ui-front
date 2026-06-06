import assert from 'node:assert/strict'
import test from 'node:test'
import {
  autoGridPx,
  buildAutoEquipmentPlacements,
  isLiveMap3DShape,
  placementToWorld,
  worldToPlacement,
} from '../src/features/live-map/lib/live-map-3d.model.ts'

test('isLiveMap3DShape guards v2 prims shape', () => {
  assert.equal(isLiveMap3DShape({ v: 2, prims: [] }), true)
  assert.equal(isLiveMap3DShape({ v: 1, root: {} }), false)
  assert.equal(isLiveMap3DShape({ v: 2 }), false)
  assert.equal(isLiveMap3DShape(null), false)
})

test('placementToWorld / worldToPlacement round-trip', () => {
  const [x, y] = placementToWorld(675, 355)
  assert.deepEqual([x, y], [0, 0])
  const [px, py] = worldToPlacement(x, y)
  assert.deepEqual([Math.round(px), Math.round(py)], [675, 355])
})

// 회귀: 편집 모드에서 설비 하나를 배치(승격)하면 다른 자동 설비가 빈 자리로 당겨져 겹치던 버그.
// 위치는 전체 리스트의 고정 index 기반이어야 하므로, placed 가 달라져도 나머지 설비 위치는 동일해야 한다.
test('buildAutoEquipmentPlacements keeps other equipment positions stable when some are placed', () => {
  const eqpKeys = [10, 20, 30, 40, 50]

  const none = buildAutoEquipmentPlacements(eqpKeys, new Set())
  const someePlaced = buildAutoEquipmentPlacements(eqpKeys, new Set([10, 30]))

  const pos = (list: ReturnType<typeof buildAutoEquipmentPlacements>, key: number) =>
    list.find((item) => item.eqpKey === key)

  // 배치된 10, 30 은 자동 목록에서 빠진다.
  assert.equal(pos(someePlaced, 10), undefined)
  assert.equal(pos(someePlaced, 30), undefined)

  // 남은 20, 40, 50 의 위치는 10, 30 배치 여부와 무관하게 동일(전체 index 고정).
  assert.deepEqual(pos(someePlaced, 20), pos(none, 20))
  assert.deepEqual(pos(someePlaced, 40), pos(none, 40))
  assert.deepEqual(pos(someePlaced, 50), pos(none, 50))

  // 각 설비 위치는 전체 리스트에서의 자기 index 로 계산된다.
  const [x20, y20] = autoGridPx(1, eqpKeys.length)
  assert.deepEqual(pos(none, 20), { eqpKey: 20, xPx: x20, yPx: y20 })
})
