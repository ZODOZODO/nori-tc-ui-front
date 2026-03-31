import { useQuery } from '@tanstack/react-query'
import { eqpApi } from '@/features/eqp/api/eqp.api'
import { eqpQueryKeys } from '@/features/eqp/lib/eqp-query-keys'

/**
 * Deploy Register 선택 설비의 파라미터 버전 목록을 조회합니다.
 * EQP 화면과 같은 API/캐시 규약을 재사용합니다.
 */
export function useDeployEqpParamVersions(eqpId: string | null) {
  return useQuery({
    queryKey: eqpQueryKeys.paramVersions(eqpId),
    queryFn: () => eqpApi.getEqpParamVersions(eqpId as string),
    enabled: Boolean(eqpId),
    staleTime: 0,
  })
}
