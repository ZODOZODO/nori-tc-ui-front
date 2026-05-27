import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLiveMapEquipmentNodes } from '../src/features/live-map/lib/live-map-data.ts'
import { LIVE_MAP_CLUSTER_ITEMS } from '../src/features/live-map/mocks/live-map.mock.ts'

test('clusterId 기준으로 고정 공정 카드에 자동 배치한다', () => {
  const equipmentNodes = buildLiveMapEquipmentNodes(
    [
      {
        eqpId: 'EQP-02',
        eqpName: 'EQP-02',
        lineValue: 'A_LINE',
        lineLabel: 'A Line',
        clusterId: 'cvd',
        clusterName: 'CVD',
        equipmentModeLabel: '2 Ports',
        status: 'RUN',
        statusLabel: 'RUN',
        portItems: [],
        tooltipMeta: 'meta',
        tooltipStep: 'step',
        alertMessage: null,
      },
      {
        eqpId: 'EQP-01',
        eqpName: 'EQP-01',
        lineValue: 'A_LINE',
        lineLabel: 'A Line',
        clusterId: 'cvd',
        clusterName: 'CVD',
        equipmentModeLabel: '1 Port',
        status: 'IDLE',
        statusLabel: 'IDLE',
        portItems: [],
        tooltipMeta: 'meta',
        tooltipStep: 'step',
        alertMessage: null,
      },
    ],
    LIVE_MAP_CLUSTER_ITEMS,
  )

  assert.equal(equipmentNodes.length, 2)
  assert.equal(equipmentNodes[0]?.eqpId, 'EQP-01')
  assert.equal(equipmentNodes[1]?.eqpId, 'EQP-02')
  assert.equal(equipmentNodes[0]?.clusterId, 'cvd')
  // x = cluster.x + LIVE_MAP_NODE_OFFSET_X(24) + columnIndex * LIVE_MAP_NODE_GAP_X(52)
  assert.equal(equipmentNodes[0]?.x, LIVE_MAP_CLUSTER_ITEMS[0].x + 24)
  assert.equal(equipmentNodes[1]?.x, LIVE_MAP_CLUSTER_ITEMS[0].x + 24 + 52)
})

test('정의되지 않은 공정은 ETC 카드에 배치한다', () => {
  const equipmentNodes = buildLiveMapEquipmentNodes(
    [
      {
        eqpId: 'EQP-99',
        eqpName: 'EQP-99',
        lineValue: 'A_LINE',
        lineLabel: 'A Line',
        clusterId: 'custom',
        clusterName: 'CUSTOM',
        equipmentModeLabel: '-',
        status: 'DOWN',
        statusLabel: 'DOWN',
        portItems: [],
        tooltipMeta: 'meta',
        tooltipStep: 'step',
        alertMessage: null,
      },
    ],
    LIVE_MAP_CLUSTER_ITEMS,
  )

  assert.equal(equipmentNodes[0]?.clusterId, 'etc')
})
