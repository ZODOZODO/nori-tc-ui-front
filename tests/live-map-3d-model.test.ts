import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBayEquipmentPlacements,
  buildLineBays,
  floorForCluster,
  isLiveMap3DShape,
  placementToWorld,
  worldToPlacement,
  type BayEquipmentInput,
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

const eq = (eqpKey: number, clusterId: string, clusterName: string): BayEquipmentInput => ({ eqpKey, clusterId, clusterName })

// 회귀: 편집 모드에서 설비 하나를 배치(승격)하면 다른 자동 설비가 빈 자리로 당겨져 겹치던 버그.
// bay 배치 위치는 cluster 그룹 내 고정 index 기반이어야 하므로, placed 가 달라져도 나머지 설비 위치는 동일해야 한다.
test('buildBayEquipmentPlacements keeps other equipment positions stable when some are placed', () => {
  const equipments = [10, 20, 30, 40, 50].map((key) => eq(key, 'cmp', 'CMP'))

  const none = buildBayEquipmentPlacements(equipments, new Set())
  const somePlaced = buildBayEquipmentPlacements(equipments, new Set([10, 30]))

  const pos = (list: ReturnType<typeof buildBayEquipmentPlacements>, key: number) => list.find((item) => item.eqpKey === key)

  // 배치된 10, 30 은 자동 목록에서 빠진다.
  assert.equal(pos(somePlaced, 10), undefined)
  assert.equal(pos(somePlaced, 30), undefined)

  // 남은 20, 40, 50 의 위치는 10, 30 배치 여부와 무관하게 동일(그룹 내 index 고정).
  assert.deepEqual(pos(somePlaced, 20), pos(none, 20))
  assert.deepEqual(pos(somePlaced, 40), pos(none, 40))
  assert.deepEqual(pos(somePlaced, 50), pos(none, 50))

  // 단일 cluster 는 상단 bay(통로 향함, 회전 0) + 공정→층(cmp=2F)으로 배치된다.
  const p20 = pos(none, 20)
  assert.ok(p20)
  assert.equal(p20.rotationDeg, 0)
  assert.equal(p20.floor, floorForCluster('cmp'))
  assert.ok(p20.xPx > 0 && p20.yPx > 0)
})

// 공정(cluster)별로 bay 가 만들어지고, 공정→층 매핑(photo=1F, cmp=2F, wet=3F)대로 층이 배정된다.
test('buildLineBays groups equipment into one bay per cluster with process floor', () => {
  const bays = buildLineBays([
    eq(1, 'photo', 'PHOTO'),
    eq(2, 'photo', 'PHOTO'),
    eq(3, 'cmp', 'CMP'),
    eq(4, 'wet', 'WET'),
  ])

  assert.equal(bays.length, 3)
  const byCluster = new Map(bays.map((bay) => [bay.clusterId, bay]))
  assert.equal(byCluster.get('photo')?.floor, 1)
  assert.equal(byCluster.get('cmp')?.floor, 2)
  assert.equal(byCluster.get('wet')?.floor, 3)
})
