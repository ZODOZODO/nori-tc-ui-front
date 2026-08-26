import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBusinessAppNameByPartition,
  groupEqpItems,
  resolveGatewayInstanceView,
} from '@/features/eqp/utils/eqp-group.util.ts'
import type {
  BusinessAppAssignment,
  EqpInfo,
  GatewayShardLease,
  RuntimeInstance,
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
  { groupId: 'group-1', ownedPartitions: [0, 1], ownerInstanceId: 'tc-gateway:uid-a:boot-a' },
  { groupId: 'group-2', ownedPartitions: [2, 3], ownerInstanceId: null },
]

// 살아 있는 business Pod 2 개 — 백엔드가 담당 partition 최솟값 순으로 정렬해 내려준다.
const assignments: BusinessAppAssignment[] = [
  { host: '10.244.2.80', memberIds: ['member-a-eqp', 'member-a-ui'], ownedPartitions: [0, 1, 2] },
  { host: '10.244.1.62', memberIds: ['member-b-eqp'], ownedPartitions: [3, 4, 5] },
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
  // groupId 는 인스턴스 조망(점유 Pod / spare)과 맞추는 조인 키다.
  assert.equal(gatewayGroups[0].groupId, 'group-1')
  assert.equal(gatewayGroups[1].appName, 'gateway_app2')
  assert.deepEqual(gatewayGroups[1].items.map((eqp) => eqp.eqpId), ['EQ_P3'])
  assert.equal(gatewayGroups[1].isUnleased, true)
  assert.equal(gatewayGroups[1].groupId, 'group-2')
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
  // 단일 인스턴스 호환 모드에는 대응하는 shard group 정의가 없다.
  assert.equal(gatewayGroups[0].groupId, null)
})

test('어느 lease group에도 없는 partition의 EQP는 gateway 그룹에 포함되지 않는다', () => {
  const { gatewayGroups } = groupEqpItems([buildEqp('EQ_P9', 9)], leases, assignments)

  assert.deepEqual(gatewayGroups[0].items, [])
  assert.deepEqual(gatewayGroups[1].items, [])
})

test('business 그룹은 살아 있는 Pod 의 partition 할당 기준으로 분류된다', () => {
  const eqpItems = [buildEqp('EQ_P0', 0), buildEqp('EQ_P5', 5), buildEqp('EQ_P2', 2)]

  const { businessGroups } = groupEqpItems(eqpItems, leases, assignments)

  assert.equal(businessGroups.length, 2)
  assert.equal(businessGroups[0].appName, 'business_app1')
  assert.deepEqual(businessGroups[0].items.map((eqp) => eqp.eqpId), ['EQ_P0', 'EQ_P2'])
  assert.equal(businessGroups[0].isUnassigned, false)
  // business_app{N} 은 Pod 하나다 — 어느 Pod 인지는 host 로만 특정된다.
  assert.equal(businessGroups[0].host, '10.244.2.80')
  assert.equal(businessGroups[1].appName, 'business_app2')
  assert.deepEqual(businessGroups[1].items.map((eqp) => eqp.eqpId), ['EQ_P5'])
  assert.equal(businessGroups[1].host, '10.244.1.62')
})

test('businessAssignments가 undefined(미조회)면 business 그룹을 만들지 않는다', () => {
  const { businessGroups } = groupEqpItems([buildEqp('EQ_P0', 0)], leases, undefined)

  assert.deepEqual(businessGroups, [])
})

test('담당 partition이 없는 Pod 도 그룹으로 유지하고 미배정으로 표시한다', () => {
  const { businessGroups } = groupEqpItems(
    [buildEqp('EQ_P0', 0)],
    leases,
    [
      { host: null, memberIds: ['member-a'], ownedPartitions: [0] },
      { host: null, memberIds: ['member-idle'], ownedPartitions: [] },
    ],
  )

  assert.equal(businessGroups.length, 2)
  assert.equal(businessGroups[1].appName, 'business_app2')
  assert.deepEqual(businessGroups[1].items, [])
  assert.equal(businessGroups[1].isUnassigned, true)
})

const gatewayInstances: RuntimeInstance[] = [
  {
    sessionId: 'tc-gateway:uid-a:boot-a',
    podName: 'tc-gateway-5bdc8-owner',
    podIp: '10.244.1.52',
    state: 'ACTIVE_SYNCED',
    protocolVersion: '1',
    registeredAtEpochMs: 1000,
    updatedAtEpochMs: 2000,
  },
  {
    sessionId: 'tc-gateway:uid-s:boot-s',
    podName: 'tc-gateway-5bdc8-spare',
    podIp: '10.244.2.142',
    state: 'ACTIVE_SYNCED',
    protocolVersion: '1',
    registeredAtEpochMs: 1000,
    updatedAtEpochMs: 2000,
  },
]

// 살아 있는 business Pod — consumer group 의 host(Pod IP)와 맞춰 Pod 이름을 얻는 원천이다.
const businessInstances: RuntimeInstance[] = [
  {
    sessionId: 'tc-business:uid-a:boot-a',
    podName: 'tc-business-5b7fd78965-987d9',
    podIp: '10.244.2.80',
    state: 'ACTIVE_SYNCED',
    protocolVersion: '1',
    registeredAtEpochMs: 1000,
    updatedAtEpochMs: 2000,
  },
]

test('점유 Pod 이름은 lease의 sessionId로 인스턴스와 맞춰 찾는다', () => {
  const { ownerPodNameByGroupId } = resolveGatewayInstanceView(leases, gatewayInstances)

  assert.equal(ownerPodNameByGroupId.get('group-1'), 'tc-gateway-5bdc8-owner')
  // 미점유 group 에는 소유 Pod 이 없다.
  assert.equal(ownerPodNameByGroupId.get('group-2'), undefined)
})

test('어떤 shard group도 잡지 못한 살아 있는 Pod은 spare로 분류된다', () => {
  // shard group 수(설정값)와 Pod 수(replica 수)가 달라 생기는 상태 — lease 만 보면 사라진다.
  const { spareInstances } = resolveGatewayInstanceView(leases, gatewayInstances)

  assert.deepEqual(spareInstances.map((instance) => instance.podName), ['tc-gateway-5bdc8-spare'])
})

test('동기화되지 않은 상태의 Pod은 spare로 분류하지 않는다', () => {
  /*
   * FENCED 는 heartbeat 를 계속 갱신하므로 상태를 보지 않으면 영구히 "대기 중" 으로 표시된다.
   * JOINING / STOPPING 도 슬롯을 이어받을 수 없다 — gateway 는 ACTIVE_SYNCED 만 처리 권한으로 본다.
   */
  const notReadyStates = ['JOINING', 'QUIESCED', 'FENCED', 'STOPPING', null]

  notReadyStates.forEach((state, stateIndex) => {
    const { spareInstances } = resolveGatewayInstanceView(leases, [
      gatewayInstances[0],
      { ...gatewayInstances[1], sessionId: `tc-gateway:uid-${stateIndex}:boot`, state },
    ])

    assert.deepEqual(spareInstances, [], `${state} 는 대기 인스턴스가 아니다`)
  })
})

test('인스턴스를 조회하지 못했으면 spare를 판정하지 않는다', () => {
  const { ownerPodNameByGroupId, spareInstances } = resolveGatewayInstanceView(leases, undefined)

  assert.equal(ownerPodNameByGroupId.size, 0)
  assert.deepEqual(spareInstances, [])
})

test('lease를 조회하지 못했으면 살아 있는 Pod을 spare로 뒤집지 않는다', () => {
  // 점유 여부를 모르는 상태에서 "owner 아님" 으로 판정하면 전부 대기 Pod 이 된다.
  const { spareInstances } = resolveGatewayInstanceView(undefined, gatewayInstances)

  assert.deepEqual(spareInstances, [])
})

test('대기 Pod은 shard group 뒤 번호를 이어받아 gateway_app 노드가 된다', () => {
  /*
   * 사용자가 세는 단위는 Pod 이다 — 3대를 띄웠는데 shard group 이 2개라 2개만 보이면
   * "3번째가 왜 없냐" 가 된다. shard 가 없으므로 설비는 0대이고 spareInstance 로 구분한다.
   */
  const { gatewayGroups } = groupEqpItems([buildEqp('EQ_P0', 0)], leases, assignments, {
    gatewaySpare: [gatewayInstances[1]],
  })

  assert.equal(gatewayGroups.length, 3)
  assert.equal(gatewayGroups[2].appName, 'gateway_app3')
  assert.deepEqual(gatewayGroups[2].items, [])
  assert.equal(gatewayGroups[2].isUnleased, false, '대기 Pod 은 미점유 shard group 이 아니다')
  assert.equal(gatewayGroups[2].groupId, null)
  assert.equal(gatewayGroups[2].spareInstance?.podName, 'tc-gateway-5bdc8-spare')
  // shard group 노드는 대기 Pod 이 아니다.
  assert.equal(gatewayGroups[0].spareInstance, null)
})

test('business_app 노드의 Pod 이름은 host(Pod IP)로 membership과 맞춰 찾는다', () => {
  const { businessGroups } = groupEqpItems([buildEqp('EQ_P0', 0)], leases, assignments, {
    business: businessInstances,
  })

  assert.equal(businessGroups[0].host, '10.244.2.80')
  assert.equal(businessGroups[0].podName, 'tc-business-5b7fd78965-987d9')
  // 맞출 수 없으면 null — 이름을 모른다는 사실을 추정으로 덮지 않는다.
  assert.equal(businessGroups[1].host, '10.244.1.62')
  assert.equal(businessGroups[1].podName, null)
})

test('business 인스턴스를 조회하지 못했으면 Pod 이름은 null이다', () => {
  const { businessGroups } = groupEqpItems([buildEqp('EQ_P0', 0)], leases, assignments)

  assert.equal(businessGroups[0].podName, null)
  assert.equal(businessGroups[0].host, '10.244.2.80')
})

test('buildBusinessAppNameByPartition은 partition을 담당 Pod 이름으로 옮긴다', () => {
  const nameByPartition = buildBusinessAppNameByPartition(assignments)

  assert.equal(nameByPartition.get(0), 'business_app1')
  assert.equal(nameByPartition.get(2), 'business_app1')
  assert.equal(nameByPartition.get(3), 'business_app2')
  assert.equal(nameByPartition.get(9), undefined)
  assert.equal(buildBusinessAppNameByPartition(undefined).size, 0)
})
