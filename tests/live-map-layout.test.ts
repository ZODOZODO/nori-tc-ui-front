import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyLiveMapClusterPositionDrafts,
  applyLiveMapEquipmentPositionDrafts,
  clampLiveMapEquipmentPosition,
  clampLiveMapRectPosition,
  LIVE_MAP_MACHINE_NODE_HEIGHT,
  LIVE_MAP_MACHINE_NODE_WIDTH,
} from '../src/features/live-map/lib/live-map-layout.ts'
import {
  resolveSelectedLiveMapEquipment,
  summarizeLiveMapEquipmentNodesByCluster,
} from '../src/features/live-map/lib/live-map-selectors.ts'
import {
  LIVE_MAP_BOARD_HEIGHT,
  LIVE_MAP_BOARD_WIDTH,
  LIVE_MAP_CLUSTER_ITEMS,
  LIVE_MAP_EQUIPMENT_NODES,
} from '../src/features/live-map/mocks/live-map.mock.ts'

test('설비 draft 좌표는 대상 설비만 덮어쓰고 나머지 좌표는 유지합니다', () => {
  const movedNodes = applyLiveMapEquipmentPositionDrafts(LIVE_MAP_EQUIPMENT_NODES, {
    'A-EQ10': { x: 420, y: 188 },
  })

  const movedEquipment = movedNodes.find((equipment) => equipment.eqpId === 'A-EQ10')
  const untouchedEquipment = movedNodes.find((equipment) => equipment.eqpId === 'A-EQ09')

  assert.equal(movedEquipment?.x, 420)
  assert.equal(movedEquipment?.y, 188)
  assert.equal(untouchedEquipment?.x, LIVE_MAP_EQUIPMENT_NODES[8]?.x)
  assert.equal(untouchedEquipment?.y, LIVE_MAP_EQUIPMENT_NODES[8]?.y)
})

test('drag 중 계산된 좌표는 보드 경계를 넘지 않도록 보정합니다', () => {
  const clampedPosition = clampLiveMapEquipmentPosition(
    { x: LIVE_MAP_BOARD_WIDTH + 80, y: -24 },
    LIVE_MAP_BOARD_WIDTH,
    LIVE_MAP_BOARD_HEIGHT,
  )

  assert.equal(clampedPosition.x, LIVE_MAP_BOARD_WIDTH - LIVE_MAP_MACHINE_NODE_WIDTH)
  assert.equal(clampedPosition.y, 0)

  const lowerClampedPosition = clampLiveMapEquipmentPosition(
    { x: -100, y: LIVE_MAP_BOARD_HEIGHT + 100 },
    LIVE_MAP_BOARD_WIDTH,
    LIVE_MAP_BOARD_HEIGHT,
  )

  assert.equal(lowerClampedPosition.x, 0)
  assert.equal(lowerClampedPosition.y, LIVE_MAP_BOARD_HEIGHT - LIVE_MAP_MACHINE_NODE_HEIGHT)
})

test('공정 카드 drag 좌표도 보드 경계를 넘지 않도록 보정합니다', () => {
  const clampedClusterPosition = clampLiveMapRectPosition(
    { x: LIVE_MAP_BOARD_WIDTH + 120, y: LIVE_MAP_BOARD_HEIGHT + 80 },
    232,
    280,
    LIVE_MAP_BOARD_WIDTH,
    LIVE_MAP_BOARD_HEIGHT,
  )

  assert.equal(clampedClusterPosition.x, LIVE_MAP_BOARD_WIDTH - 232)
  assert.equal(clampedClusterPosition.y, LIVE_MAP_BOARD_HEIGHT - 280)
})

test('선택 설비 fallback은 draft 좌표가 반영된 ERROR 설비를 우선합니다', () => {
  const movedNodes = applyLiveMapEquipmentPositionDrafts(LIVE_MAP_EQUIPMENT_NODES, {
    'A-EQ17': { x: 512, y: 272 },
  })
  const visibleNodes = movedNodes.filter((equipment) => equipment.status === 'ERROR')

  const selectedEquipment = resolveSelectedLiveMapEquipment(movedNodes, visibleNodes, null)

  assert.equal(selectedEquipment?.eqpId, 'A-EQ17')
  assert.equal(selectedEquipment?.x, 512)
  assert.equal(selectedEquipment?.y, 272)
})

test('live map 공정 보드는 10개 공정 단위로 구성됩니다', () => {
  assert.equal(LIVE_MAP_CLUSTER_ITEMS.length, 10)
  assert.deepEqual(
    LIVE_MAP_CLUSTER_ITEMS.map((cluster) => cluster.title),
    ['CVD', 'CMP', 'DIFF', 'PHOTO', 'METRO', 'METAL', 'ETCH', 'IMP', 'WET', 'ETC'],
  )
})

test('공정 카드 draft 좌표는 대상 공정 카드만 덮어씁니다', () => {
  const movedClusters = applyLiveMapClusterPositionDrafts(LIVE_MAP_CLUSTER_ITEMS, {
    cvd: { x: 120, y: 180 },
  })

  const movedCluster = movedClusters.find((cluster) => cluster.id === 'cvd')
  const untouchedCluster = movedClusters.find((cluster) => cluster.id === 'cmp')

  assert.equal(movedCluster?.x, 120)
  assert.equal(movedCluster?.y, 180)
  assert.equal(untouchedCluster?.x, LIVE_MAP_CLUSTER_ITEMS[1]?.x)
  assert.equal(untouchedCluster?.y, LIVE_MAP_CLUSTER_ITEMS[1]?.y)
})

test('공정 카드 요약은 포함된 설비 상태를 모두 집계합니다', () => {
  const clusterSummaries = summarizeLiveMapEquipmentNodesByCluster(LIVE_MAP_EQUIPMENT_NODES)

  assert.deepEqual(clusterSummaries.cvd, {
    total: 3,
    run: 3,
    idle: 0,
    error: 0,
    down: 0,
  })
  assert.deepEqual(clusterSummaries.metal, {
    total: 3,
    run: 2,
    idle: 0,
    error: 1,
    down: 0,
  })
  assert.deepEqual(clusterSummaries.etch, {
    total: 3,
    run: 2,
    idle: 1,
    error: 0,
    down: 0,
  })
})

test('설비 tooltip용 포트 상태와 처리 방식 정보가 설비별로 존재합니다', () => {
  const metalEquipment = LIVE_MAP_EQUIPMENT_NODES.find((equipment) => equipment.eqpId === 'A-EQ17')
  const cmpEquipment = LIVE_MAP_EQUIPMENT_NODES.find((equipment) => equipment.eqpId === 'A-EQ05')

  assert.equal(metalEquipment?.processingTypeLabel, 'Batch')
  assert.equal(cmpEquipment?.processingTypeLabel, 'Single')
  assert.ok(metalEquipment?.portItems.length && metalEquipment.portItems.length >= 4)
  assert.ok(cmpEquipment?.portItems.some((portItem) => portItem.status === 'DOWN'))
  assert.ok(metalEquipment?.portItems.some((portItem) => portItem.status === 'IDLE'))
  assert.equal(metalEquipment?.statusLabel, 'ERROR')
})
