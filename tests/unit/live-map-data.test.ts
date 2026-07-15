import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLiveMapEquipmentNodes } from '@/features/live-map/lib/live-map-data.ts'

const equipmentResponse = (overrides: {
  eqpId: string
  clusterId: string
  clusterName: string
  status?: 'RUN' | 'IDLE' | 'ERROR' | 'DOWN'
  equipmentModeLabel?: string
}) => ({
  eqpKey: Number.parseInt(overrides.eqpId.replace(/\D+/g, ''), 10),
  eqpId: overrides.eqpId,
  eqpName: overrides.eqpId,
  lineValue: 'A_LINE',
  lineLabel: 'A Line',
  clusterId: overrides.clusterId,
  clusterName: overrides.clusterName,
  equipmentModeLabel: overrides.equipmentModeLabel ?? '1 Port',
  status: overrides.status ?? 'RUN',
  statusLabel: overrides.status ?? 'RUN',
  portItems: [],
  tooltipMeta: 'meta',
  tooltipStep: 'step',
  alertMessage: null,
})

test('clusterId → eqpId 순으로 정렬해 표시 필드를 매핑한다', () => {
  const equipmentNodes = buildLiveMapEquipmentNodes([
    equipmentResponse({ eqpId: 'EQP-02', clusterId: 'cvd', clusterName: 'CVD', equipmentModeLabel: '2 Ports' }),
    equipmentResponse({ eqpId: 'EQP-03', clusterId: 'cmp', clusterName: 'CMP' }),
    equipmentResponse({ eqpId: 'EQP-01', clusterId: 'cvd', clusterName: 'CVD', status: 'IDLE' }),
  ])

  assert.deepEqual(
    equipmentNodes.map((node) => node.eqpId),
    ['EQP-03', 'EQP-01', 'EQP-02'],
  )
  assert.equal(equipmentNodes[1]?.clusterId, 'cvd')
  assert.equal(equipmentNodes[2]?.processingTypeLabel, '2 Ports')
})

test('clusterId 는 API 값을 그대로 유지한다(고정 공정 카탈로그 정규화 없음)', () => {
  const equipmentNodes = buildLiveMapEquipmentNodes([
    equipmentResponse({ eqpId: 'EQP-99', clusterId: 'custom', clusterName: 'CUSTOM', status: 'DOWN' }),
  ])

  assert.equal(equipmentNodes[0]?.clusterId, 'custom')
  assert.equal(equipmentNodes[0]?.clusterName, 'CUSTOM')
})

test('port carrierId 값을 null 포함 그대로 매핑한다', () => {
  const response = equipmentResponse({ eqpId: 'EQP-01', clusterId: 'cvd', clusterName: 'CVD' })
  response.portItems = [
    { id: 'LP1', label: '1', carrierId: 'CAR-01', status: 'RUN', statusLabel: 'RUN' },
    { id: 'LP2', label: '2', carrierId: null, status: 'IDLE', statusLabel: 'IDLE' },
  ]

  const equipmentNodes = buildLiveMapEquipmentNodes([response])

  assert.equal(equipmentNodes[0]?.portItems[0]?.carrierId, 'CAR-01')
  assert.equal(equipmentNodes[0]?.portItems[1]?.carrierId, null)
})
