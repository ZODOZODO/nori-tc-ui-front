import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLiveMapDemoRunRows,
  buildLiveMapDemoTree,
  collectLiveMapDemoEquipmentsByEqpIds,
  collectLiveMapDemoExpandableNodeIds,
  collectLiveMapDemoTreeEqpIds,
  filterLiveMapDemoTree,
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

  const firstEquipmentNode = demoTree[0]?.children[0]?.children[0]
  assert.equal(firstEquipmentNode?.type, 'EQUIPMENT')
  assert.equal(typeof firstEquipmentNode?.eqpName, 'string')
  assert.ok((firstEquipmentNode?.eqpName ?? '').length > 0)
})

test('체크된 eqpId 들은 demo target 설비 객체로 변환됩니다', () => {
  const targetEquipments = collectLiveMapDemoEquipmentsByEqpIds(
    ['A-EQ16', 'A-EQ18'],
    LIVE_MAP_EQUIPMENT_NODES,
  )

  assert.deepEqual(
    targetEquipments.map((targetEquipment) => targetEquipment.eqpId),
    ['A-EQ16', 'A-EQ18'],
  )
})

test('대상 설비 병합은 기존 설비를 유지하면서 중복 설비를 추가하지 않습니다', () => {
  const mergedTargets = mergeLiveMapDemoTargetEquipments(
    collectLiveMapDemoEquipmentsByEqpIds(['A-EQ17'], LIVE_MAP_EQUIPMENT_NODES),
    collectLiveMapDemoEquipmentsByEqpIds(
      ['A-EQ16', 'A-EQ17', 'A-EQ18'],
      LIVE_MAP_EQUIPMENT_NODES,
    ),
  )

  assert.deepEqual(
    mergedTargets.map((equipment) => equipment.eqpId),
    ['A-EQ17', 'A-EQ16', 'A-EQ18'],
  )
})

test('공정 노드는 하위 설비 eqpId 전체를 수집해 일괄 토글에 사용할 수 있습니다', () => {
  const demoTree = buildLiveMapDemoTree(LIVE_MAP_EQUIPMENT_NODES, LIVE_MAP_CLUSTER_ITEMS)
  const metalProcessNode = demoTree[0]?.children.find(
    (childNode) => childNode.clusterId === 'metal',
  )

  assert.ok(metalProcessNode, 'metal 공정 노드가 트리에 존재해야 합니다')
  assert.deepEqual(collectLiveMapDemoTreeEqpIds(metalProcessNode), [
    'A-EQ16',
    'A-EQ17',
    'A-EQ18',
  ])
})

test('검색 키워드는 매칭된 설비만 남기고 부모 공정/라인을 자동으로 유지합니다', () => {
  const demoTree = buildLiveMapDemoTree(LIVE_MAP_EQUIPMENT_NODES, LIVE_MAP_CLUSTER_ITEMS)
  const filteredTree = filterLiveMapDemoTree(demoTree, 'A-EQ17')

  assert.equal(filteredTree.length, 1)
  assert.equal(filteredTree[0]?.children.length, 1)
  assert.equal(filteredTree[0]?.children[0]?.clusterId, 'metal')
  assert.deepEqual(
    filteredTree[0]?.children[0]?.children.map((equipmentNode) => equipmentNode.label),
    ['A-EQ17'],
  )
})

test('검색 키워드가 비어 있으면 모든 노드를 그대로 유지합니다', () => {
  const demoTree = buildLiveMapDemoTree(LIVE_MAP_EQUIPMENT_NODES, LIVE_MAP_CLUSTER_ITEMS)
  const filteredTree = filterLiveMapDemoTree(demoTree, '   ')

  assert.equal(filteredTree.length, demoTree.length)
  assert.equal(filteredTree[0]?.children.length, demoTree[0]?.children.length)
})

test('펼침 가능한 노드 ID는 자식이 있는 LINE/PROCESS 노드만 포함합니다', () => {
  const demoTree = buildLiveMapDemoTree(LIVE_MAP_EQUIPMENT_NODES, LIVE_MAP_CLUSTER_ITEMS)
  const expandableNodeIds = collectLiveMapDemoExpandableNodeIds(demoTree)

  assert.ok(expandableNodeIds.includes('line:A_LINE'))
  assert.ok(expandableNodeIds.includes('process:metal'))
  assert.ok(expandableNodeIds.every((nodeId) => !nodeId.startsWith('equipment:')))
})

test('demo run row는 설비별로 순차 진행률과 상태를 계산합니다', () => {
  const selectedScenario = LIVE_MAP_DEMO_SCENARIO_OPTIONS[0]
  const runTargets = collectLiveMapDemoEquipmentsByEqpIds(
    ['A-EQ01', 'A-EQ02', 'A-EQ03'],
    LIVE_MAP_EQUIPMENT_NODES,
  )
  const runRows = buildLiveMapDemoRunRows(runTargets, selectedScenario, 9)

  assert.equal(runRows[0]?.progress, 100)
  assert.equal(runRows[0]?.statusText, '완료')
  assert.equal(runRows[1]?.statusText, '진행 중')
  assert.ok((runRows[1]?.progress ?? 0) < 100)
  assert.equal(runRows[2]?.statusText, '진행 중')
  assert.ok((runRows[2]?.progress ?? 0) > 0)
})
