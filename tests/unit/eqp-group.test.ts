import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBusinessAppNameByPartition,
  groupEqpItems,
} from '@/features/eqp/utils/eqp-group.util.ts'
import type {
  BusinessAppAssignment,
  EqpInfo,
  GatewayShardLease,
} from '@/features/eqp/types/eqp.types.ts'

const buildEqp = (eqpId: string, routePartition: number | null): EqpInfo => ({
  eqpKey: 1,
  eqpId,
  lineKey: 1,
  commInterface: 'SOCKET',
  commMode: 'ACTIVE',
  isDev: true,
  routePartition,
  eqpIp: '127.0.0.1',
  eqpPort: 10001,
  modelVersionKey: 1,
  enabled: true,
  createdAt: '2026-06-11T00:00:00Z',
  updatedAt: '2026-06-11T00:00:00Z',
  createdBy: 'SYSTEM',
  updatedBy: 'SYSTEM',
})

const leases: GatewayShardLease[] = [
  { groupId: 'group-1', ownedPartitions: [0, 1], ownerInstanceId: 'pod-a-uuid-1' },
  { groupId: 'group-2', ownedPartitions: [2, 3], ownerInstanceId: null },
]

// 살아 있는 business 프로세스 2 개 — 백엔드가 담당 partition 최솟값 순으로 정렬해 내려준다.
const assignments: BusinessAppAssignment[] = [
  { memberId: 'member-a', host: '10.244.2.80', ownedPartitions: [0, 1, 2] },
  { memberId: 'member-b', host: '10.244.1.62', ownedPartitions: [3, 4, 5] },
]

test('gateway 그룹은 shard lease의 ownedPartitions 기준으로 분류된다', () => {
  const eqpItems = [
    buildEqp('EQ_P3', 3),
    buildEqp('EQ_P0', 0),
    buildEqp('EQ_P1', 1),
    buildEqp('EQ_INVALID', null),
  ]

  const { gatewayGroups } = groupEqpItems(eqpItems, leases, assignments)

  assert.equal(gatewayGroups.length, 2)
  assert.equal(gatewayGroups[0].appName, 'gateway_app1')
  assert.deepEqual(gatewayGroups[0].items.map((eqp) => eqp.eqpId), ['EQ_P0', 'EQ_P1'])
  assert.equal(gatewayGroups[0].isUnleased, false)
  assert.equal(gatewayGroups[1].appName, 'gateway_app2')
  assert.deepEqual(gatewayGroups[1].items.map((eqp) => eqp.eqpId), ['EQ_P3'])
  assert.equal(gatewayGroups[1].isUnleased, true)
})

test('lease가 미점유인 그룹은 배정 설비가 없어도 유지된다', () => {
  const { gatewayGroups } = groupEqpItems([buildEqp('EQ_P0', 0)], leases, assignments)

  assert.equal(gatewayGroups.length, 2)
  assert.deepEqual(gatewayGroups[1].items, [])
  assert.equal(gatewayGroups[1].isUnleased, true)
})

test('shardLeases가 undefined(미조회)면 gateway 그룹을 만들지 않는다', () => {
  const { gatewayGroups, businessGroups } = groupEqpItems([buildEqp('EQ_P0', 0)], undefined, assignments)

  assert.deepEqual(gatewayGroups, [])
  // business 그룹은 shard lease 와 무관한 축이라 gateway 미조회에도 그대로 만들어진다.
  assert.equal(businessGroups.length, 2)
})

test('shardLeases가 빈 배열(단일 인스턴스 모드)이면 전체를 gateway_app1로 묶는다', () => {
  const { gatewayGroups } = groupEqpItems(
    [buildEqp('EQ_P7', 7), buildEqp('EQ_P0', 0)],
    [],
    assignments,
  )

  assert.equal(gatewayGroups.length, 1)
  assert.equal(gatewayGroups[0].appName, 'gateway_app1')
  assert.deepEqual(gatewayGroups[0].items.map((eqp) => eqp.eqpId), ['EQ_P0', 'EQ_P7'])
  assert.equal(gatewayGroups[0].isUnleased, false)
})

test('어느 lease group에도 없는 partition의 EQP는 gateway 그룹에 포함되지 않는다', () => {
  const { gatewayGroups } = groupEqpItems([buildEqp('EQ_P9', 9)], leases, assignments)

  assert.deepEqual(gatewayGroups[0].items, [])
  assert.deepEqual(gatewayGroups[1].items, [])
})

test('business 그룹은 살아 있는 프로세스의 partition 할당 기준으로 분류된다', () => {
  const eqpItems = [buildEqp('EQ_P0', 0), buildEqp('EQ_P5', 5), buildEqp('EQ_P2', 2)]

  const { businessGroups } = groupEqpItems(eqpItems, leases, assignments)

  assert.equal(businessGroups.length, 2)
  assert.equal(businessGroups[0].appName, 'business_app1')
  assert.deepEqual(businessGroups[0].items.map((eqp) => eqp.eqpId), ['EQ_P0', 'EQ_P2'])
  assert.equal(businessGroups[0].isUnassigned, false)
  assert.equal(businessGroups[1].appName, 'business_app2')
  assert.deepEqual(businessGroups[1].items.map((eqp) => eqp.eqpId), ['EQ_P5'])
})

test('businessAssignments가 undefined(미조회)면 business 그룹을 만들지 않는다', () => {
  const { businessGroups } = groupEqpItems([buildEqp('EQ_P0', 0)], leases, undefined)

  assert.deepEqual(businessGroups, [])
})

test('담당 partition이 없는 프로세스도 그룹으로 유지하고 미배정으로 표시한다', () => {
  const { businessGroups } = groupEqpItems(
    [buildEqp('EQ_P0', 0)],
    leases,
    [
      { memberId: 'member-a', host: null, ownedPartitions: [0] },
      { memberId: 'member-idle', host: null, ownedPartitions: [] },
    ],
  )

  assert.equal(businessGroups.length, 2)
  assert.equal(businessGroups[1].appName, 'business_app2')
  assert.deepEqual(businessGroups[1].items, [])
  assert.equal(businessGroups[1].isUnassigned, true)
})

test('buildBusinessAppNameByPartition은 partition을 담당 프로세스 이름으로 옮긴다', () => {
  const nameByPartition = buildBusinessAppNameByPartition(assignments)

  assert.equal(nameByPartition.get(0), 'business_app1')
  assert.equal(nameByPartition.get(2), 'business_app1')
  assert.equal(nameByPartition.get(3), 'business_app2')
  assert.equal(nameByPartition.get(9), undefined)
  assert.equal(buildBusinessAppNameByPartition(undefined).size, 0)
})
