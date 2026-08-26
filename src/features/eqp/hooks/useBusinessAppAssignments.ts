import { useQuery } from '@tanstack/react-query'
import { eqpApi } from '../api/eqp.api'
import { eqpQueryKeys } from '../lib/eqp-query-keys'

/**
 * Business 프로세스별 partition 할당 조회 훅입니다.
 * EQP 목록을 business_app 단위 그룹으로 분류하는 기준 데이터로 사용합니다.
 */
export function useBusinessAppAssignments() {
  return useQuery({
    queryKey: eqpQueryKeys.businessAppAssignments(),
    queryFn: () => eqpApi.getBusinessAppAssignments(),
    // 할당은 business 재기동/리밸런스 시 바뀌므로 shard lease 와 같은 60초 주기로 재검증한다.
    staleTime: 60_000,
  })
}
