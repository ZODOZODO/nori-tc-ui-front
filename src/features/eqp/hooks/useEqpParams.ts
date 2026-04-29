import { useQuery } from '@tanstack/react-query'
import { eqpApi } from '../api/eqp.api'
import { eqpQueryKeys } from '../lib/eqp-query-keys'

/**
 * 선택된 EQP의 특정 버전 파라미터 목록을 조회합니다.
 *
 * eqpId 또는 version이 없으면 요청하지 않습니다.
 */
export function useEqpParams(eqpId: string | null, version: string | null) {
  return useQuery({
    queryKey: eqpQueryKeys.params(eqpId, version),
    queryFn: () => eqpApi.getEqpParams(eqpId as string, version as string),
    enabled: Boolean(eqpId) && Boolean(version),
    // 버전 변경 시 항상 최신 데이터를 보장하기 위해 staleTime: 0 사용
    staleTime: 0,
  })
}
