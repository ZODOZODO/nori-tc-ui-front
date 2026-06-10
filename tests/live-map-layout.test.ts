import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveSelectedLiveMapEquipment } from '../src/features/live-map/lib/live-map-selectors.ts'
import { LIVE_MAP_EQUIPMENT_NODES } from '../src/features/live-map/mocks/live-map.mock.ts'

test('선택 설비 fallback은 ERROR 설비를 우선합니다', () => {
  const visibleNodes = LIVE_MAP_EQUIPMENT_NODES.filter((equipment) => equipment.status === 'ERROR')

  const selectedEquipment = resolveSelectedLiveMapEquipment(
    LIVE_MAP_EQUIPMENT_NODES,
    visibleNodes,
    null,
  )

  assert.equal(selectedEquipment?.eqpId, 'A-EQ17')
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

test('mock 설비 노드는 안정적인 eqpKey 를 가집니다(중복 없음)', () => {
  const eqpKeys = LIVE_MAP_EQUIPMENT_NODES.map((equipment) => equipment.eqpKey)
  assert.equal(new Set(eqpKeys).size, eqpKeys.length)
  assert.ok(eqpKeys.every((eqpKey) => Number.isInteger(eqpKey) && eqpKey > 0))
})
