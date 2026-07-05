import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDefaultStructureLayout,
  isLiveMap3DShape,
  LIVE_MAP_BOARD_PX_HEIGHT,
  LIVE_MAP_BOARD_PX_WIDTH,
  LIVE_MAP_BUILTIN_STRUCTURES,
  LIVE_MAP_FAB_LINE_LAYOUT,
  LIVE_MAP_SNAP_PX,
  LIVE_MAP_WORLD_SCALE,
  placementToWorld,
  planEquipmentLineLayout,
  shapeBoundingBox,
  snapToGrid,
  worldToPlacement,
} from '@/features/live-map/lib/live-map-3d.model.ts'

test('isLiveMap3DShape guards v2 prims shape', () => {
  assert.equal(isLiveMap3DShape({ v: 2, prims: [] }), true)
  assert.equal(isLiveMap3DShape({ v: 1, root: {} }), false)
  assert.equal(isLiveMap3DShape({ v: 2 }), false)
  assert.equal(isLiveMap3DShape(null), false)
})

test('placementToWorld / worldToPlacement round-trip (board center → world origin)', () => {
  const cx = LIVE_MAP_BOARD_PX_WIDTH / 2
  const cy = LIVE_MAP_BOARD_PX_HEIGHT / 2
  const [x, y] = placementToWorld(cx, cy)
  assert.deepEqual([x, y], [0, 0])
  const [px, py] = worldToPlacement(x, y)
  assert.deepEqual([Math.round(px), Math.round(py)], [cx, cy])
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

// 구조물 편집(라이브러리)에는 벽/파티션/바닥/기둥이 빌트인으로 항상 노출된다 — 구조물도 이 라이브러리 객체로만 배치한다.
test('LIVE_MAP_BUILTIN_STRUCTURES exposes wall/partition/floor/column as library builtins', () => {
  const names = LIVE_MAP_BUILTIN_STRUCTURES.map((structure) => structure.objectName)
  assert.deepEqual([...names].sort(), ['기둥', '바닥', '벽', '파티션'])
  // 빌트인 키는 모두 음수 sentinel(양수 DB 키·설비 자동표시 0 과 비충돌) + v2 도형.
  for (const structure of LIVE_MAP_BUILTIN_STRUCTURES) {
    assert.ok(structure.objectKey < 0, `${structure.objectName} 빌트인 키는 음수 sentinel`)
    assert.ok(isLiveMap3DShape(structure.shapeJson), `${structure.objectName} 도형은 v2`)
  }
  const column = LIVE_MAP_BUILTIN_STRUCTURES.find((structure) => structure.slug === 'column')
  assert.ok(column, '기둥(column) 빌트인이 존재해야 한다')
  assert.equal(column.objectName, '기둥')
})

// 기본 구조 시드 — 빈 레이아웃 시작점. 모든 항목은 빌트인 구조물 키이고 board 안 양수 px 에 놓인다.
// 4종(벽/파티션/바닥/기둥)을 모두 포함해야 저장 시 각 STRUCTURE 객체가 생성된다.
test('buildDefaultStructureLayout seeds a fab room from builtin structures within the board', () => {
  const seeds = buildDefaultStructureLayout()
  assert.ok(seeds.length > 0, '시드는 비어 있지 않다')

  const builtinKeys = new Set(LIVE_MAP_BUILTIN_STRUCTURES.map((structure) => structure.objectKey))
  for (const seed of seeds) {
    assert.ok(builtinKeys.has(seed.objectKey), `시드 objectKey ${seed.objectKey} 는 빌트인 구조물 키`)
    assert.ok(seed.xPx > 0 && seed.xPx < LIVE_MAP_BOARD_PX_WIDTH, '시드 x 는 board 안')
    assert.ok(seed.yPx > 0 && seed.yPx < LIVE_MAP_BOARD_PX_HEIGHT, '시드 y 는 board 안')
  }

  // 벽/파티션/바닥/기둥 4종 모두 포함.
  const usedKeys = new Set(seeds.map((seed) => seed.objectKey))
  for (const slug of ['wall', 'partition', 'floor', 'column']) {
    const key = LIVE_MAP_BUILTIN_STRUCTURES.find((structure) => structure.slug === slug)?.objectKey
    assert.ok(key !== undefined && usedKeys.has(key), `시드에 ${slug} 포함`)
  }
})

// fab 라인 배치 — gateway_app 기준 층 매핑(floorByEqpKey)대로 설비를 해당 층에 배치한다.
test('planEquipmentLineLayout places each equipment on its gateway_app floor', () => {
  const floorByEqpKey = new Map<number, number>([
    [501, 1],
    [502, 1],
    [503, 1],
    [504, 2],
    [505, 2],
  ])
  const placements = planEquipmentLineLayout([501, 502, 503, 504, 505], floorByEqpKey, 1, LIVE_MAP_FAB_LINE_LAYOUT)

  assert.equal(placements.length, 5, '미배치 설비 5대 모두 배치')
  const floorOf = (eqpKey: number) => placements.find((p) => p.eqpKey === eqpKey)?.floor
  assert.equal(floorOf(501), 1)
  assert.equal(floorOf(503), 1)
  assert.equal(floorOf(504), 2, 'gateway_app2 설비는 2층')
  assert.equal(floorOf(505), 2)
  // 모든 설비가 보드 안 양수 좌표 — 씬 밖으로 새지 않는다.
  for (const placement of placements) {
    assert.ok(placement.xPx > 0 && placement.xPx < LIVE_MAP_BOARD_PX_WIDTH, 'x 는 board 안')
    assert.ok(placement.yPx > 0 && placement.yPx < LIVE_MAP_BOARD_PX_HEIGHT, 'y 는 board 안')
  }
})

// 분류 불가 설비(floorByEqpKey 미존재)는 누락하지 않고 fallbackFloor 로 보낸다.
test('planEquipmentLineLayout sends unmapped equipment to fallback floor (no drop)', () => {
  const floorByEqpKey = new Map<number, number>([[700, 2]])
  const placements = planEquipmentLineLayout([700, 701, 702], floorByEqpKey, 1, LIVE_MAP_FAB_LINE_LAYOUT)

  assert.equal(placements.length, 3, '매핑 없는 설비도 누락 없이 배치')
  assert.equal(placements.find((p) => p.eqpKey === 700)?.floor, 2)
  assert.equal(placements.find((p) => p.eqpKey === 701)?.floor, 1, '매핑 없으면 fallback 1층')
  assert.equal(placements.find((p) => p.eqpKey === 702)?.floor, 1)
})

// fab 라인 — 중앙 spine 통로(1080~1320 px)는 비우고, 한 줄이 차면 다음 줄(Z↑)로 내려간다.
test('planEquipmentLineLayout keeps a central aisle and wraps to the next bay lane', () => {
  const floorByEqpKey = new Map<number, number>()
  // 한 줄 슬롯 수보다 많게(좌 6 + 우 6 = 12 → 13번째는 다음 줄) 배치.
  const eqpKeys = Array.from({ length: 13 }, (_, i) => 10 + i)
  const placements = planEquipmentLineLayout(eqpKeys, floorByEqpKey, 1, LIVE_MAP_FAB_LINE_LAYOUT)

  // 좌표 유일(겹침 없음).
  const coords = placements.map((p) => `${p.xPx},${p.yPx}`)
  assert.equal(new Set(coords).size, eqpKeys.length, '모든 좌표가 유일(겹침 없음)')

  // 중앙 spine 통로(1080 초과 ~ 1320 미만)에는 설비가 없다.
  for (const placement of placements) {
    assert.ok(!(placement.xPx > 1080 && placement.xPx < 1320), `중앙 통로 비움 — x=${placement.xPx}`)
  }

  // 첫 줄(12대)은 같은 Z, 13번째는 다음 줄(Z 가 lanePitch 만큼 큼).
  const firstLaneZ = placements[0].yPx
  for (let i = 0; i < 12; i += 1) {
    assert.equal(placements[i].yPx, firstLaneZ, `첫 줄 ${i} 는 같은 Z`)
  }
  assert.equal(placements[12].yPx, firstLaneZ + LIVE_MAP_FAB_LINE_LAYOUT.lanePitchPx, '13번째는 다음 bay 줄')

  // 줄(lane) 짝수 180° / 홀수 0° 교대 — 등(back)이 파티션 쪽을 향해 chase 를 이루고 전면은 통로로 열린다.
  for (let i = 0; i < 12; i += 1) {
    assert.equal(placements[i].rotationDeg, 180, `첫 줄 ${i} 는 180° (등이 파티션 향함)`)
  }
  assert.equal(placements[12].rotationDeg, 0, '둘째 줄은 0° (첫 줄과 등 맞댄 chase)')
})

// 선택 박스용 bounding box — prim 들의 위치/크기를 감싸는 축정렬 박스(중심/크기).
test('shapeBoundingBox encloses prims (center and size)', () => {
  // 바닥 빌트인: 10×0.2×10, 중심 (0, 0.1, 0).
  const floor = LIVE_MAP_BUILTIN_STRUCTURES.find((s) => s.slug === 'floor')
  assert.ok(floor, '바닥 빌트인 존재')
  const box = shapeBoundingBox(floor.shapeJson)
  assert.deepEqual(box.size, { x: 10, y: 0.2, z: 10 }, '바닥 크기')
  assert.deepEqual(box.center, { x: 0, y: 0.1, z: 0 }, '바닥 중심')

  // 빈 도형은 안전한 단위 박스로(0 division/Infinity 방지).
  const empty = shapeBoundingBox({ v: 2, prims: [] })
  assert.deepEqual(empty.size, { x: 1, y: 1, z: 1 }, '빈 도형은 단위 박스')
})
