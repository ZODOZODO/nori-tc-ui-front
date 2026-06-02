import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterLiveMapEquipmentNodes,
  LIVE_MAP_ALL_LINES,
} from '../src/features/live-map/lib/live-map-selectors.ts'
import type { LiveMapEquipmentNode } from '../src/features/live-map/types/live-map.types.ts'

const node = (eqpId: string, lineValue: string, lineLabel: string): LiveMapEquipmentNode => ({
  eqpId,
  eqpName: eqpId,
  lineValue,
  lineLabel,
  processingType: 'SINGLE',
  processingTypeLabel: 'Single',
  clusterId: 'cvd',
  clusterName: 'CVD',
  sectorId: 'cvd',
  sectorName: 'CVD',
  status: 'RUN',
  statusLabel: 'RUN',
  x: 0,
  y: 0,
  portItems: [],
  tooltipMeta: '',
  tooltipStep: '',
  alertMessage: null,
})

const nodes: LiveMapEquipmentNode[] = [
  node('EQP-A1', 'A_LINE', 'A Line'),
  node('EQP-B1', 'B_LINE', 'B Line'),
  node('EQP-A2', 'A_LINE', 'A Line'),
]

test('lineFilter 미지정이면 전체 라인을 반환한다', () => {
  const result = filterLiveMapEquipmentNodes(nodes, { statusFilter: 'ALL', searchKeyword: '' })
  assert.equal(result.length, 3)
})

test('lineFilter=ALL 이면 전체 라인을 반환한다', () => {
  const result = filterLiveMapEquipmentNodes(nodes, {
    statusFilter: 'ALL',
    searchKeyword: '',
    lineFilter: LIVE_MAP_ALL_LINES,
  })
  assert.equal(result.length, 3)
})

test('선택 라인의 설비만 반환한다(라인 스코프)', () => {
  const result = filterLiveMapEquipmentNodes(nodes, {
    statusFilter: 'ALL',
    searchKeyword: '',
    lineFilter: 'A_LINE',
  })
  assert.deepEqual(
    result.map((item) => item.eqpId),
    ['EQP-A1', 'EQP-A2'],
  )
})

test('라인 스코프와 검색어 필터는 AND 로 결합된다', () => {
  const result = filterLiveMapEquipmentNodes(nodes, {
    statusFilter: 'ALL',
    searchKeyword: 'EQP-A2',
    lineFilter: 'A_LINE',
  })
  assert.deepEqual(
    result.map((item) => item.eqpId),
    ['EQP-A2'],
  )
})

test('매칭되는 라인이 없으면 빈 배열을 반환한다', () => {
  const result = filterLiveMapEquipmentNodes(nodes, {
    statusFilter: 'ALL',
    searchKeyword: '',
    lineFilter: 'Z_LINE',
  })
  assert.equal(result.length, 0)
})
