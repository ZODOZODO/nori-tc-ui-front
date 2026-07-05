import assert from 'node:assert/strict'
import test from 'node:test'
import { groupEqpItems, resolveBusinessAppName } from '@/features/eqp/utils/eqp-group.util.ts'
import type { EqpInfo, GatewayShardLease } from '@/features/eqp/types/eqp.types.ts'

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

test('gateway 그룹은 shard lease의 ownedPartitions 기준으로 분류된다', () => {
  const eqpItems = [
    buildEqp('EQ_P3', 3),
    buildEqp('EQ_P0', 0),
    buildEqp('EQ_P1', 1),
    buildEqp('EQ_INVALID', null),
  ]

  const { gatewayGroups } = groupEqpItems(eqpItems, leases)

  assert.equal(gatewayGroups.length, 2)
  assert.equal(gatewayGroups[0].appName, 'gateway_app1')
  assert.deepEqual(gatewayGroups[0].items.map((eqp) => eqp.eqpId), ['EQ_P0', 'EQ_P1'])
  assert.equal(gatewayGroups[0].isUnleased, false)
  assert.equal(gatewayGroups[1].appName, 'gateway_app2')
  assert.deepEqual(gatewayGroups[1].items.map((eqp) => eqp.eqpId), ['EQ_P3'])
  assert.equal(gatewayGroups[1].isUnleased, true)
})

test('lease가 미점유인 그룹은 배정 설비가 없어도 유지된다', () => {
  const { gatewayGroups } = groupEqpItems([buildEqp('EQ_P0', 0)], leases)

  assert.equal(gatewayGroups.length, 2)
  assert.deepEqual(gatewayGroups[1].items, [])
  assert.equal(gatewayGroups[1].isUnleased, true)
})

test('shardLeases가 undefined(미조회)면 gateway 그룹을 만들지 않는다', () => {
  const { gatewayGroups, businessGroups } = groupEqpItems([buildEqp('EQ_P0', 0)], undefined)

  assert.deepEqual(gatewayGroups, [])
  assert.equal(businessGroups.length, 1)
})

test('shardLeases가 빈 배열(단일 인스턴스 모드)이면 전체를 gateway_app1로 묶는다', () => {
  const { gatewayGroups } = groupEqpItems(
    [buildEqp('EQ_P7', 7), buildEqp('EQ_P0', 0)],
    [],
  )

  assert.equal(gatewayGroups.length, 1)
  assert.equal(gatewayGroups[0].appName, 'gateway_app1')
  assert.deepEqual(gatewayGroups[0].items.map((eqp) => eqp.eqpId), ['EQ_P0', 'EQ_P7'])
  assert.equal(gatewayGroups[0].isUnleased, false)
})

test('어느 lease group에도 없는 partition의 EQP는 gateway 그룹에 포함되지 않는다', () => {
  const { gatewayGroups } = groupEqpItems([buildEqp('EQ_P9', 9)], leases)

  assert.deepEqual(gatewayGroups[0].items, [])
  assert.deepEqual(gatewayGroups[1].items, [])
})

test('business 그룹은 기존 partition/6 산술 규칙을 유지한다', () => {
  const eqpItems = [buildEqp('EQ_P0', 0), buildEqp('EQ_P5', 5), buildEqp('EQ_P6', 6)]

  const { businessGroups } = groupEqpItems(eqpItems, leases)

  assert.equal(businessGroups.length, 2)
  assert.equal(businessGroups[0].appName, 'business_app1')
  assert.deepEqual(businessGroups[0].items.map((eqp) => eqp.eqpId), ['EQ_P0', 'EQ_P5'])
  assert.equal(businessGroups[1].appName, 'business_app2')

  assert.equal(resolveBusinessAppName(0), 'business_app1')
  assert.equal(resolveBusinessAppName(6), 'business_app2')
})
