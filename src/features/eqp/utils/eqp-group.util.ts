import type { BusinessAppGroup, EqpInfo, GatewayAppGroup, GatewayShardLease } from '../types/eqp.types'

/**
 * route_partition 기준으로 연결된 business app 이름을 계산합니다.
 *
 * 규칙: route_partition 6개씩 묶어 business_app{N} 구성
 * 예: [0..5] → business_app1, [6..11] → business_app2
 */
export function resolveBusinessAppName(routePartition: number | null | undefined): string | null {
  if (typeof routePartition !== 'number' || routePartition < 0) {
    return null
  }

  return `business_app${Math.floor(routePartition / 6) + 1}`
}

/**
 * EQP 목록을 gateway_app / business_app 그룹으로 분류합니다.
 *
 * gateway 그룹화 규칙: Redis shard lease(= shard-group 설정 + 점유 인스턴스) 기준
 * - shardLeases 정의 순서대로 gateway_app{N} 그룹을 구성하고,
 *   route_partition이 해당 group의 ownedPartitions에 속한 EQP를 배정합니다.
 * - lease 소유 인스턴스가 없는 group은 isUnleased=true로 표시합니다(배정 EQP가 없어도 그룹 유지).
 * - shardLeases가 undefined(미조회/조회 실패)면 gateway 그룹을 구성하지 않습니다.
 * - shardLeases가 빈 배열(단일 인스턴스 호환 모드)이면 유효 partition EQP 전체를
 *   gateway_app1 단일 그룹으로 묶습니다.
 *
 * business 그룹화 규칙: route_partition 6개씩 묶어 business_app{N} 구성 (기존 산술 유지)
 *
 * @param eqpItems 그룹화할 EQP 목록
 * @param shardLeases gateway shard lease 점유 현황 (조회 전이면 undefined)
 * @returns gatewayGroups(shard lease 단위), businessGroups(6개 단위)
 */
export function groupEqpItems(
  eqpItems: EqpInfo[],
  shardLeases: GatewayShardLease[] | undefined,
): {
  gatewayGroups: GatewayAppGroup[]
  businessGroups: BusinessAppGroup[]
} {
  const groupedBusinessApps = new Map<number, EqpInfo[]>()
  const validPartitionItems: EqpInfo[] = []

  eqpItems.forEach((eqp) => {
    const partition = eqp.routePartition
    if (typeof partition !== 'number' || partition < 0) {
      return
    }

    validPartitionItems.push(eqp)

    const businessAppIndex = Math.floor(partition / 6) + 1
    const currentBusinessGroup = groupedBusinessApps.get(businessAppIndex) ?? []
    currentBusinessGroup.push(eqp)
    groupedBusinessApps.set(businessAppIndex, currentBusinessGroup)
  })

  // route_partition 변경 시 그룹 내 위치가 바뀌지 않도록 eqpId 기준으로만 정렬합니다.
  // route_partition은 그룹 분류 기준으로만 사용하며 그룹 내 순서에는 영향을 주지 않습니다.
  const sortGroupItems = (items: EqpInfo[]) =>
    [...items].sort((left, right) => left.eqpId.localeCompare(right.eqpId))

  const gatewayGroups: GatewayAppGroup[] = (() => {
    if (shardLeases === undefined) {
      return []
    }

    if (shardLeases.length === 0) {
      // shard-group 설정이 없는 단일 인스턴스 호환 모드 — 전체를 단일 그룹으로 표시합니다.
      if (validPartitionItems.length === 0) {
        return []
      }
      return [
        {
          appIndex: 1,
          appName: 'gateway_app1',
          items: sortGroupItems(validPartitionItems),
          isUnleased: false,
        },
      ]
    }

    return shardLeases.map((lease, leaseIndex) => {
      const ownedPartitionSet = new Set(lease.ownedPartitions)
      const appIndex = leaseIndex + 1
      return {
        appIndex,
        appName: `gateway_app${appIndex}`,
        items: sortGroupItems(
          validPartitionItems.filter((eqp) =>
            typeof eqp.routePartition === 'number' && ownedPartitionSet.has(eqp.routePartition),
          ),
        ),
        isUnleased: lease.ownerInstanceId === null,
      }
    })
  })()

  const businessGroups: BusinessAppGroup[] = Array.from(groupedBusinessApps.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([appIndex, items]) => ({
      appIndex,
      appName: `business_app${appIndex}`,
      items: sortGroupItems(items),
    }))

  return {
    gatewayGroups,
    businessGroups,
  }
}
