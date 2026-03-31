import { useQuery } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import { deployQueryKeys } from '../lib/deploy-query-keys'

/**
 * Deploy 생성 시나리오 목록을 조회합니다.
 */
export function useDeployScenarios(eventType: string, enabled = true) {
  return useQuery({
    queryKey: deployQueryKeys.scenarios(eventType),
    queryFn: () => deployApi.getScenarios(eventType),
    enabled,
    staleTime: 60_000,
  })
}

