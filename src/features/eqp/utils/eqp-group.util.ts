import type {
  BusinessAppAssignment,
  BusinessAppGroup,
  EqpInfo,
  GatewayAppGroup,
  GatewayShardLease,
} from '../types/eqp.types'

/**
 * route_partition → 그 partition 을 담당하는 business_app 이름 대응표를 만듭니다.
 *
 * <p>표의 "Business App" 열과 사이드바 그룹이 같은 답을 내야 하므로 이름 규칙을 한곳에 둡니다.
 * 할당을 아직 조회하지 못했으면(undefined) 빈 표 — 호출부는 `—` 로 표시합니다.</p>
 */
export function buildBusinessAppNameByPartition(
  businessAssignments: BusinessAppAssignment[] | undefined,
): Map<number, string> {
  const nameByPartition = new Map<number, string>()

  ;(businessAssignments ?? []).forEach((assignment, assignmentIndex) => {
    const appName = `business_app${assignmentIndex + 1}`
    assignment.ownedPartitions.forEach((partition) => {
      nameByPartition.set(partition, appName)
    })
  })

  return nameByPartition
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
 * business 그룹화 규칙: 살아 있는 business 프로세스(consumer group 멤버)의 partition 할당 기준
 * - 멤버 하나가 business_app{N} 하나이며, 순서는 백엔드가 고정해 내려준 순서를 따릅니다.
 * - 담당 partition 이 없는 멤버는 isUnassigned=true 로 유지합니다(프로세스는 떠 있으므로 숨기지 않음).
 * - businessAssignments 가 undefined(미조회/조회 실패)면 business 그룹을 구성하지 않습니다.
 *
 * @param eqpItems 그룹화할 EQP 목록
 * @param shardLeases gateway shard lease 점유 현황 (조회 전이면 undefined)
 * @param businessAssignments business 프로세스별 partition 할당 (조회 전이면 undefined)
 * @returns gatewayGroups(shard lease 단위), businessGroups(business 프로세스 단위)
 */
export function groupEqpItems(
  eqpItems: EqpInfo[],
  shardLeases: GatewayShardLease[] | undefined,
  businessAssignments: BusinessAppAssignment[] | undefined,
): {
  gatewayGroups: GatewayAppGroup[]
  businessGroups: BusinessAppGroup[]
} {
  const validPartitionItems = eqpItems.filter(
    (eqp) => typeof eqp.routePartition === 'number' && eqp.routePartition >= 0,
  )

  // route_partition 변경 시 그룹 내 위치가 바뀌지 않도록 eqpId 기준으로만 정렬합니다.
  // route_partition은 그룹 분류 기준으로만 사용하며 그룹 내 순서에는 영향을 주지 않습니다.
  const sortGroupItems = (items: EqpInfo[]) =>
    [...items].sort((left, right) => left.eqpId.localeCompare(right.eqpId))

  const itemsOfPartitions = (ownedPartitions: readonly number[]) => {
    const ownedPartitionSet = new Set(ownedPartitions)
    return sortGroupItems(
      validPartitionItems.filter(
        (eqp) => typeof eqp.routePartition === 'number' && ownedPartitionSet.has(eqp.routePartition),
      ),
    )
  }

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
      const appIndex = leaseIndex + 1
      return {
        appIndex,
        appName: `gateway_app${appIndex}`,
        items: itemsOfPartitions(lease.ownedPartitions),
        isUnleased: lease.ownerInstanceId === null,
      }
    })
  })()

  const businessGroups: BusinessAppGroup[] = (businessAssignments ?? []).map(
    (assignment, assignmentIndex) => {
      const appIndex = assignmentIndex + 1
      return {
        appIndex,
        appName: `business_app${appIndex}`,
        items: itemsOfPartitions(assignment.ownedPartitions),
        isUnassigned: assignment.ownedPartitions.length === 0,
      }
    },
  )

  return {
    gatewayGroups,
    businessGroups,
  }
}
