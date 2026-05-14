import { useQuery } from '@tanstack/react-query'
import { eqpApi } from '../api/eqp.api'
import { eqpQueryKeys } from '../lib/eqp-query-keys'

/**
 * 선택된 EQP의 modelVersionKey를 기준으로 모델 정보를 조회합니다.
 * modelVersionKey가 유효하지 않으면 요청하지 않습니다.
 */
export function useEqpModelInfo(modelVersionKey: number | null) {
  return useQuery({
    queryKey: eqpQueryKeys.modelInfo(modelVersionKey),
    queryFn: () => eqpApi.getEqpModelInfoByVersionKey(modelVersionKey as number),
    enabled: typeof modelVersionKey === 'number' && modelVersionKey > 0,
    staleTime: 0,
  })
}
