import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBayEquipmentPlacements,
  buildLineBays,
  floorForCluster,
  isLiveMap3DShape,
  LIVE_MAP_BOARD_PX_HEIGHT,
  LIVE_MAP_BOARD_PX_WIDTH,
  LIVE_MAP_ROOM_MIN_DEPTH,
  LIVE_MAP_SNAP_PX,
  LIVE_MAP_WORLD_SCALE,
  liveMapRoomSizeWorld,
  placementToWorld,
  snapToGrid,
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

test('snapToGrid rounds px to the nearest grid cell (1 world unit)', () => {
  assert.equal(LIVE_MAP_SNAP_PX, LIVE_MAP_WORLD_SCALE)
  assert.equal(snapToGrid(0), 0)
  // 격자 1칸(=WORLD_SCALE px) 단위로 반올림 — 절반 미만은 내림, 절반 이상은 올림.
  assert.equal(snapToGrid(LIVE_MAP_SNAP_PX * 0.49), 0)
  assert.equal(snapToGrid(LIVE_MAP_SNAP_PX * 0.5), LIVE_MAP_SNAP_PX)
  assert.equal(snapToGrid(LIVE_MAP_SNAP_PX * 2.3), LIVE_MAP_SNAP_PX * 2)
  // 음수 좌표도 가장 가까운 격자점으로.
  assert.equal(snapToGrid(-LIVE_MAP_SNAP_PX * 1.4), -LIVE_MAP_SNAP_PX)
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

  // cmp 5대는 bay 내부 통로 좌/우 2열로 마주본다 — 좌 열 90°(+x 면)·우 열 270°(−x 면).
  // key 20 은 그룹 내 index 1 = 우 열 → 270°. 공정→층(cmp=2F).
  const p20 = pos(none, 20)
  assert.ok(p20)
  assert.equal(p20.rotationDeg, 270)
  assert.equal(p20.floor, floorForCluster('cmp'))
  assert.ok(p20.xPx > 0 && p20.yPx > 0)
})

// 회귀: 설비가 고정 룸 바닥/외벽 밖으로 floating 하던 버그. 룸 크기는 라인 범위를 덮어야 —
// 한 줄에 들어가는 작은 라인은 최소치, 여러 컨베이어 줄로 접히는(wrap) 라인은 그 세로 범위를 덮게 커진다.
test('liveMapRoomSizeWorld covers the flow-line extents (incl. wrapped rows) so equipment stays on the floor', () => {
  // 작은 라인(photo 2대, 한 줄) → 룸은 최소 깊이 이상이고 그 구간을 덮는다.
  const smallBays = buildLineBays([eq(1, 'photo', 'PHOTO'), eq(2, 'photo', 'PHOTO')])
  const small = liveMapRoomSizeWorld(smallBays)
  assert.ok(small.depth >= LIVE_MAP_ROOM_MIN_DEPTH)
  const smallHalfDepthPx = Math.max(...smallBays.map((bay) => Math.abs(bay.centerYPx - LIVE_MAP_BOARD_PX_HEIGHT / 2) + bay.depthPx / 2))
  assert.ok(small.depth / 2 >= smallHalfDepthPx / LIVE_MAP_WORLD_SCALE, 'room covers the small line')

  // 한 층(1F)에 폭 넓은 공정 3개(각 12대) → 한 줄을 넘겨 여러 컨베이어 줄로 접힘. 룸은 가로/세로 전 구간을 덮어야 한다.
  const line = buildLineBays([
    ...Array.from({ length: 12 }, (_, i) => eq(100 + i, 'etch', 'ETCH')),
    ...Array.from({ length: 12 }, (_, i) => eq(200 + i, 'photo', 'PHOTO')),
    ...Array.from({ length: 12 }, (_, i) => eq(300 + i, 'cvd', 'CVD')),
  ]).filter((bay) => bay.floor === 1)
  const room = liveMapRoomSizeWorld(line)
  const maxHalfWidthPx = Math.max(...line.map((bay) => Math.abs(bay.centerXPx - LIVE_MAP_BOARD_PX_WIDTH / 2) + bay.widthPx / 2))
  const maxHalfDepthPx = Math.max(...line.map((bay) => Math.abs(bay.centerYPx - LIVE_MAP_BOARD_PX_HEIGHT / 2) + bay.depthPx / 2))
  assert.ok(room.width / 2 >= maxHalfWidthPx / LIVE_MAP_WORLD_SCALE, 'room half-width must cover the line')
  assert.ok(room.depth / 2 >= maxHalfDepthPx / LIVE_MAP_WORLD_SCALE, 'room half-depth must cover the wrapped rows')
})

// fishbone: 모든 bay 의 폭(좌/우 2열)은 동일하고, 설비 많은 공정은 스파인 바깥으로 길어질 뿐이다 — 6대 vs 12대: 폭 동일, 길이 2배.
test('fishbone bay keeps uniform width and lengthens away from the spine for larger clusters', () => {
  const bay6 = buildLineBays(Array.from({ length: 6 }, (_, i) => eq(i + 1, 'cmp', 'CMP')))[0]
  const bay12 = buildLineBays(Array.from({ length: 12 }, (_, i) => eq(i + 1, 'diff', 'DIFF')))[0]

  // 폭(가로, 좌/우 2열)은 전 공정 동일, 길이(세로, 스파인 바깥)는 12대가 6대의 2배(줄 6 vs 3).
  assert.equal(bay12.widthPx, bay6.widthPx)
  assert.equal(bay12.depthPx, bay6.depthPx * 2)

  // 12대는 내부 통로 좌/우 2열(x 2개) × 6줄(y 6개)로 놓인다.
  const placements = buildBayEquipmentPlacements(Array.from({ length: 12 }, (_, i) => eq(i + 1, 'diff', 'DIFF')), new Set())
  assert.equal(placements.length, 12)
  assert.equal(new Set(placements.map((p) => p.xPx)).size, 2)
  assert.equal(new Set(placements.map((p) => p.yPx)).size, 6)
})

// 공정(cluster)별로 구간이 만들어지고, 공정→층 매핑(2개 층: photo/wet=1F, cmp/metal=2F)대로 층이 배정된다.
test('buildLineBays groups equipment into one bay per cluster with process floor', () => {
  const bays = buildLineBays([
    eq(1, 'photo', 'PHOTO'),
    eq(2, 'photo', 'PHOTO'),
    eq(3, 'cmp', 'CMP'),
    eq(4, 'wet', 'WET'),
    eq(5, 'metal', 'METAL'),
  ])

  assert.equal(bays.length, 4)
  const byCluster = new Map(bays.map((bay) => [bay.clusterId, bay]))
  assert.equal(byCluster.get('photo')?.floor, 1)
  assert.equal(byCluster.get('wet')?.floor, 1)
  assert.equal(byCluster.get('cmp')?.floor, 2)
  assert.equal(byCluster.get('metal')?.floor, 2)
})
