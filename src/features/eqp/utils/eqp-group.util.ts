import type {
  BusinessAppAssignment,
  BusinessAppGroup,
  EqpInfo,
  GatewayAppGroup,
  GatewayShardLease,
  RuntimeInstance,
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
 * 슬롯을 이어받을 수 있는 membership 상태.
 *
 * <p>gateway 는 `ACTIVE_SYNCED` 인 session 만 처리 권한이 있다고 판정합니다
 * (`GatewayCoordinationSession.isActiveSynced`). 그러므로 `JOINING`(동기화 중) /
 * `QUIESCED`(정지 중) / `FENCED`(권한 상실) / `STOPPING`(종료 중) 인 Pod 은 heartbeat 가 살아 있어도
 * 대기 인스턴스가 아닙니다 — 특히 `FENCED` 는 heartbeat 를 계속 갱신하므로 상태를 보지 않으면
 * 영구히 "대기 중" 으로 표시됩니다.</p>
 */
const SPARE_READY_STATE = 'ACTIVE_SYNCED'

/**
 * shard lease 점유 현황과 살아 있는 인스턴스 목록을 맞춰 owner / spare 를 가릅니다.
 *
 * <p>두 목록의 조인 키는 sessionId 입니다 — gateway 는 lease 값으로 자기 sessionId 를 기록하고,
 * membership 원장의 레코드도 같은 sessionId 로 저장됩니다.</p>
 *
 * <p>spare 는 "동기화까지 끝났는데 어떤 shard group 도 잡지 못한 Pod" 입니다. shard group 수는 설정값이고
 * Pod 수는 replica 수라 두 축의 개수가 다르므로, lease 만 보면 이 Pod 이 화면에서 사라집니다.</p>
 *
 * @param shardLeases shard lease 점유 현황 (조회 전이면 undefined)
 * @param instances 살아 있는 gateway 인스턴스 (조회 전이거나 조정 원장 미사용이면 undefined/빈 배열)
 * @returns groupId 별 소유 Pod 이름과 대기(spare) 인스턴스 목록
 */
export function resolveGatewayInstanceView(
  shardLeases: GatewayShardLease[] | undefined,
  instances: RuntimeInstance[] | undefined,
): {
  ownerPodNameByGroupId: Map<string, string>
  spareInstances: RuntimeInstance[]
} {
  const ownerPodNameByGroupId = new Map<string, string>()

  /*
   * lease 를 모르면 "이 Pod 이 슬롯을 못 잡았다" 를 판정할 근거가 없다. 빈 목록으로 두면 살아 있는
   * Pod 전부가 spare 로 뒤집히므로, 조회 전에는 아무것도 단정하지 않는다.
   */
  if (shardLeases === undefined || instances === undefined) {
    return { ownerPodNameByGroupId, spareInstances: [] }
  }

  const podNameBySessionId = new Map<string, string>()
  instances.forEach((instance) => {
    if (instance.podName) {
      podNameBySessionId.set(instance.sessionId, instance.podName)
    }
  })

  const ownerSessionIds = new Set<string>()
  shardLeases.forEach((lease) => {
    if (lease.ownerInstanceId === null) {
      return
    }
    ownerSessionIds.add(lease.ownerInstanceId)
    const podName = podNameBySessionId.get(lease.ownerInstanceId)
    if (podName) {
      ownerPodNameByGroupId.set(lease.groupId, podName)
    }
  })

  return {
    ownerPodNameByGroupId,
    spareInstances: instances.filter(
      (instance) =>
        !ownerSessionIds.has(instance.sessionId) && instance.state === SPARE_READY_STATE,
    ),
  }
}

/**
 * business Pod 의 접속 host(Pod IP) → Pod 이름 대응표를 만듭니다.
 *
 * <p>Kafka consumer group 은 멤버의 host 만 알려주므로(브로커가 Pod IP 를 기록) Pod 이름은 여기서만
 * 옵니다. 조정 원장을 쓰지 않는 배포이거나 `podIp` 를 기록하지 않은 구 Pod 이면 항목이 없고, 그때는
 * 호출부가 host 를 그대로 보여줍니다 — 이름을 모른다는 사실을 추정으로 덮지 않습니다.</p>
 *
 * @param instances 살아 있는 business 인스턴스 (조회 전이면 undefined)
 * @returns Pod IP → Pod 이름
 */
export function buildPodNameByHost(
  instances: RuntimeInstance[] | undefined,
): Map<string, string> {
  const podNameByHost = new Map<string, string>()

  ;(instances ?? []).forEach((instance) => {
    if (instance.podIp && instance.podName) {
      podNameByHost.set(instance.podIp, instance.podName)
    }
  })

  return podNameByHost
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
 * - 어떤 shard group 도 잡지 못한 대기 Pod 은 뒤 번호를 이어받아 gateway_app{N} 노드로 붙습니다
 *   (spareInstance 가 채워지며, shard 가 없으므로 설비는 0대입니다).
 *
 * business 그룹화 규칙: 살아 있는 business Pod 의 partition 할당 기준
 * - Pod 하나가 business_app{N} 하나이며, 순서는 백엔드가 고정해 내려준 순서를 따릅니다.
 *   (백엔드가 같은 host 의 consumer group 멤버를 Pod 하나로 합쳐 내려줍니다 — 멤버 수는 Pod 수의 배수입니다)
 * - 담당 partition 이 없는 Pod 은 isUnassigned=true 로 유지합니다(Pod 은 떠 있으므로 숨기지 않음).
 * - businessAssignments 가 undefined(미조회/조회 실패)면 business 그룹을 구성하지 않습니다.
 *
 * @param eqpItems 그룹화할 EQP 목록
 * @param shardLeases gateway shard lease 점유 현황 (조회 전이면 undefined)
 * @param businessAssignments business Pod 별 partition 할당 (조회 전이면 undefined)
 * @param runtimeInstances Pod 축 보강 입력 — gateway 대기 Pod 과 business Pod 이름의 원천
 * @returns gatewayGroups(shard lease + 대기 Pod 단위), businessGroups(business Pod 단위)
 */
export function groupEqpItems(
  eqpItems: EqpInfo[],
  shardLeases: GatewayShardLease[] | undefined,
  businessAssignments: BusinessAppAssignment[] | undefined,
  runtimeInstances?: {
    gatewaySpare?: RuntimeInstance[]
    business?: RuntimeInstance[]
  },
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

  const shardGroups: GatewayAppGroup[] = (() => {
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
          groupId: null,
          isUnleased: false,
          spareInstance: null,
        },
      ]
    }

    return shardLeases.map((lease, leaseIndex) => {
      const appIndex = leaseIndex + 1
      return {
        appIndex,
        appName: `gateway_app${appIndex}`,
        items: itemsOfPartitions(lease.ownedPartitions),
        groupId: lease.groupId,
        isUnleased: lease.ownerInstanceId === null,
        spareInstance: null,
      }
    })
  })()

  /*
   * 대기 Pod 도 gateway_app 번호를 이어받는다 — 사용자가 세는 단위는 Pod 이고, 목록에서 빠지면
   * "3대 띄웠는데 2개만 보인다"가 된다. shard 가 없으므로 설비는 0대이고 spareInstance 로 구분한다.
   */
  const spareGroups: GatewayAppGroup[] = (runtimeInstances?.gatewaySpare ?? []).map(
    (instance, spareIndex) => {
      const appIndex = shardGroups.length + spareIndex + 1
      return {
        appIndex,
        appName: `gateway_app${appIndex}`,
        items: [],
        groupId: null,
        isUnleased: false,
        spareInstance: instance,
      }
    },
  )

  const podNameByHost = buildPodNameByHost(runtimeInstances?.business)

  const businessGroups: BusinessAppGroup[] = (businessAssignments ?? []).map(
    (assignment, assignmentIndex) => {
      const appIndex = assignmentIndex + 1
      return {
        appIndex,
        appName: `business_app${appIndex}`,
        items: itemsOfPartitions(assignment.ownedPartitions),
        host: assignment.host,
        podName: assignment.host === null ? null : podNameByHost.get(assignment.host) ?? null,
        isUnassigned: assignment.ownedPartitions.length === 0,
      }
    },
  )

  return {
    gatewayGroups: [...shardGroups, ...spareGroups],
    businessGroups,
  }
}
