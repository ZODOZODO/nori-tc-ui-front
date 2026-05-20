import { useQuery } from '@tanstack/react-query'
import { modelFlowApi } from '../api/model-flow.api'
import { modelQueryKeys } from '../lib/model-query-keys'

/**
 * 선택된 모델의 Message Flow 목록 조회 훅입니다.
 * modelVersionKey 가 유효하지 않으면 API 호출을 하지 않습니다.
 */
export function useModelFlowList(modelVersionKey: number | null) {
  return useQuery({
    queryKey: modelQueryKeys.flows(modelVersionKey),
    queryFn: () => modelFlowApi.list(modelVersionKey as number),
    enabled: modelVersionKey !== null && modelVersionKey > 0,
    // 좌측 트리는 항상 최신 상태를 우선합니다.
    staleTime: 0,
  })
}
