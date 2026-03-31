import { useQuery } from '@tanstack/react-query'
import { eqpApi } from '@/features/eqp/api/eqp.api'
import { eqpQueryKeys } from '@/features/eqp/lib/eqp-query-keys'

/**
 * Deploy Register 설정 영역에서 사용하는 공통 옵션을 조회합니다.
 * EQP 관리 옵션과 같은 API/캐시를 재사용합니다.
 */
export function useDeployRegisterOptions(enabled = true) {
  return useQuery({
    queryKey: eqpQueryKeys.manageOptions(),
    queryFn: () => eqpApi.getEqpManageOptions(),
    enabled,
    staleTime: 60_000,
  })
}
