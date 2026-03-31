import { useQuery } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import { deployQueryKeys } from '../lib/deploy-query-keys'

/**
 * 활성 Deploy target 상태를 polling 합니다.
 */
export function useDeployTargets(
  deployKey: number | null,
  enabled = true,
  page = 0,
  size = 50,
  status: string | null = null,
  eqpId: string | null = null,
) {
  return useQuery({
    queryKey:
      deployKey === null
        ? deployQueryKeys.all
        : deployQueryKeys.targets(deployKey, page, size, status, eqpId),
    queryFn: () => deployApi.getDeployTargets(deployKey as number, page, size, status, eqpId),
    enabled: enabled && deployKey !== null,
    refetchInterval: (query) => {
      const payload = query.state.data
      if (!payload || payload.targets.length === 0) {
        return 3000
      }

      const hasRunningTarget = payload.targets.some(
        (target) => target.targetStatus === 'RUNNING' || target.targetStatus === 'PENDING',
      )

      return hasRunningTarget ? 3000 : false
    },
  })
}
