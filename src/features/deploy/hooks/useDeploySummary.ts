import { useQuery } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import { deployQueryKeys } from '../lib/deploy-query-keys'

/**
 * 활성 Deploy summary를 polling 합니다.
 */
export function useDeploySummary(deployKey: number | null, enabled = true) {
  return useQuery({
    queryKey: deployKey === null ? deployQueryKeys.all : deployQueryKeys.summary(deployKey),
    queryFn: () => deployApi.getDeploySummary(deployKey as number),
    enabled: enabled && deployKey !== null,
    refetchInterval: (query) => {
      const summary = query.state.data
      if (!summary || summary.terminal) {
        return false
      }
      return 3000
    },
  })
}
