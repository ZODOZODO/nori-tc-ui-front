import { useQuery } from '@tanstack/react-query'
import { eqpApi } from '../api/eqp.api'
import { eqpQueryKeys } from '../lib/eqp-query-keys'

/**
 * Gateway shard lease 점유 현황 조회 훅입니다.
 * EQP 목록을 gateway 단위 그룹으로 분류하는 기준 데이터로 사용합니다.
 */
export function useGatewayShardLeases() {
  return useQuery({
    queryKey: eqpQueryKeys.gatewayShardLeases(),
    queryFn: () => eqpApi.getGatewayShardLeases(),
    // lease는 gateway 재기동/failover 시 바뀌므로 목록과 같은 60초 주기로 재검증한다.
    staleTime: 60_000,
  })
}
