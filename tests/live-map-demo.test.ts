import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLiveMapDemoRunRows,
  buildLiveMapDemoTree,
  collectLiveMapDemoSelectionEquipments,
  mergeLiveMapDemoTargetEquipments,
} from '../src/features/live-map/lib/live-map-demo.ts'
import {
  LIVE_MAP_CLUSTER_ITEMS,
  LIVE_MAP_DEMO_SCENARIO_OPTIONS,
  LIVE_MAP_EQUIPMENT_NODES,
} from '../src/features/live-map/mocks/live-map.mock.ts'

test('demo tree는 line 아래에 공정과 설비를 계층형으로 구성합니다', () => {
  const demoTree = buildLiveMapDemoTree(LIVE_MAP_EQUIPMENT_NODES, LIVE_MAP_CLUSTER_ITEMS)

  assert.equal(demoTree.length, 1)
  assert.equal(demoTree[0]?.type, 'LINE')
  assert.equal(demoTree[0]?.children.length, 10)
  assert.equal(demoTree[0]?.children[0]?.type, 'PROCESS')
  assert.equal(demoTree[0]?.children[0]?.children.length, 3)
  assert.equal(demoTree[0]?.children[0]?.children[0]?.type, 'EQUIPMENT')
})

test('공정을 선택하면 해당 공정의 설비 전체가 후보로 수집됩니다', () => {
  const selectedEquipments = collectLiveMapDemoSelectionEquipments(
    'process:metal',
    LIVE_MAP_EQUIPMENT_NODES,
  )

  assert.deepEqual(
    selectedEquipments.map((equipment) => equipment.eqpId),
    ['A-EQ16', 'A-EQ17', 'A-EQ18'],
  )
})

test('대상 설비 병합은 기존 설비를 유지하면서 중복 설비를 추가하지 않습니다', () => {
  const mergedTargets = mergeLiveMapDemoTargetEquipments(
    collectLiveMapDemoSelectionEquipments('equipment:A-EQ17', LIVE_MAP_EQUIPMENT_NODES),
    collectLiveMapDemoSelectionEquipments('process:metal', LIVE_MAP_EQUIPMENT_NODES),
  )

  assert.deepEqual(
    mergedTargets.map((equipment) => equipment.eqpId),
    ['A-EQ17', 'A-EQ16', 'A-EQ18'],
  )
})

test('demo run row는 설비별로 순차 진행률과 상태를 계산합니다', () => {
  const selectedScenario = LIVE_MAP_DEMO_SCENARIO_OPTIONS[0]
  const runTargets = collectLiveMapDemoSelectionEquipments('process:cvd', LIVE_MAP_EQUIPMENT_NODES)
  const runRows = buildLiveMapDemoRunRows(runTargets, selectedScenario, 9)

  assert.equal(runRows[0]?.progress, 100)
  assert.equal(runRows[0]?.statusText, '완료')
  assert.equal(runRows[1]?.statusText, '진행 중')
  assert.ok((runRows[1]?.progress ?? 0) < 100)
  assert.equal(runRows[2]?.statusText, '진행 중')
  assert.ok((runRows[2]?.progress ?? 0) > 0)
})
