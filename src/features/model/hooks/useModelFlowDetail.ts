import { useQuery } from '@tanstack/react-query'
import { modelFlowApi } from '../api/model-flow.api'
import { modelQueryKeys } from '../lib/model-query-keys'

/**
 * 선택된 Message Flow 상세 조회 훅입니다.
 * flowId 가 유효하지 않으면 API 호출을 하지 않습니다.
 */
export function useModelFlowDetail(modelVersionKey: number | null, flowId: number | null) {
  return useQuery({
    queryKey: modelQueryKeys.flowDetail(modelVersionKey, flowId),
    queryFn: () => modelFlowApi.detail(modelVersionKey as number, flowId as number),
    enabled:
      modelVersionKey !== null && modelVersionKey > 0 && flowId !== null && flowId > 0,
    staleTime: 0,
  })
}
