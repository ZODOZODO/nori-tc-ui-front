import { useQuery } from '@tanstack/react-query'
import { eqpApi } from '../api/eqp.api'
import { eqpQueryKeys } from '../lib/eqp-query-keys'

// Pod 은 배포/재기동 시 바뀌므로 shard lease · consumer group 할당과 같은 60초 주기로 재검증한다.
const RUNTIME_INSTANCE_STALE_TIME_MS = 60_000

/**
 * gateway 런타임 인스턴스(Pod) 조망 조회 훅입니다.
 *
 * shard lease / consumer group 할당이 "누가 일을 맡았나"를 답하는 데 비해, 이 조회는 "어느 Pod 이
 * 살아 있나"를 답합니다 — 슬롯을 못 잡은 대기(spare) Pod 은 여기에만 나타납니다.
 */
export function useGatewayRuntimeInstances() {
  return useQuery({
    queryKey: eqpQueryKeys.gatewayRuntimeInstances(),
    queryFn: () => eqpApi.getGatewayRuntimeInstances(),
    staleTime: RUNTIME_INSTANCE_STALE_TIME_MS,
  })
}

/**
 * business 런타임 인스턴스(Pod) 조망 조회 훅입니다.
 *
 * consumer group 할당은 멤버의 host(Pod IP)까지만 알려주므로, business_app 노드에 Pod 이름을 붙이려면
 * 이 조회의 `podIp` 와 맞춰야 합니다.
 */
export function useBusinessRuntimeInstances() {
  return useQuery({
    queryKey: eqpQueryKeys.businessRuntimeInstances(),
    queryFn: () => eqpApi.getBusinessRuntimeInstances(),
    staleTime: RUNTIME_INSTANCE_STALE_TIME_MS,
  })
}
