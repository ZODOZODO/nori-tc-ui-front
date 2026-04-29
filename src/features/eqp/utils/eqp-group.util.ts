import type { BusinessAppGroup, EqpInfo, GatewayAppGroup } from '../types/eqp.types'

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
 * EQP 목록을 route_partition 기준으로 gateway_app / business_app 그룹으로 분류합니다.
 *
 * 그룹화 규칙: route_partition 2개씩 묶어 gateway_app{N} 그룹 구성
 * 예: [0,1] → gateway_app1, [2,3] → gateway_app2, [4,5] → gateway_app3
 *
 * @param eqpItems 그룹화할 EQP 목록
 * @returns gatewayGroups(2개 단위), businessGroups(6개 단위)
 */
export function groupEqpItems(eqpItems: EqpInfo[]): {
  gatewayGroups: GatewayAppGroup[]
  businessGroups: BusinessAppGroup[]
} {
  const groupedGatewayApps = new Map<number, EqpInfo[]>()
  const groupedBusinessApps = new Map<number, EqpInfo[]>()

  eqpItems.forEach((eqp) => {
    const partition = eqp.routePartition
    if (typeof partition !== 'number' || partition < 0) {
      return
    }

    const gatewayAppIndex = Math.floor(partition / 2) + 1
    const currentGatewayGroup = groupedGatewayApps.get(gatewayAppIndex) ?? []
    currentGatewayGroup.push(eqp)
    groupedGatewayApps.set(gatewayAppIndex, currentGatewayGroup)

    const businessAppIndex = Math.floor(partition / 6) + 1
    const currentBusinessGroup = groupedBusinessApps.get(businessAppIndex) ?? []
    currentBusinessGroup.push(eqp)
    groupedBusinessApps.set(businessAppIndex, currentBusinessGroup)
  })

  // route_partition 변경 시 그룹 내 위치가 바뀌지 않도록 eqpId 기준으로만 정렬합니다.
  // route_partition은 그룹 분류 기준으로만 사용하며 그룹 내 순서에는 영향을 주지 않습니다.
  const sortGroupItems = (items: EqpInfo[]) =>
    [...items].sort((left, right) => left.eqpId.localeCompare(right.eqpId))

  const gatewayGroups: GatewayAppGroup[] = Array.from(groupedGatewayApps.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([appIndex, items]) => ({
      appIndex,
      appName: `gateway_app${appIndex}`,
      items: sortGroupItems(items),
    }))

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
