import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import { deployQueryKeys } from '../lib/deploy-query-keys'
import type { DeployRegisterFilters } from '../types/deploy.types'

/**
 * Deploy Register 대상 설비 목록을 조회합니다.
 * 검색 버튼이 store filter를 갱신하면 같은 키로 재조회됩니다.
 */
export function useDeployRegisterTargets(
  filters: DeployRegisterFilters,
  enabled: boolean,
  searchRevision: number,
  offset = 0,
  limit = 500,
) {
  return useQuery({
    queryKey: deployQueryKeys.registerTargets(filters, searchRevision, offset, limit),
    queryFn: () => deployApi.getRegisterTargets(filters, offset, limit),
    enabled,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
}
