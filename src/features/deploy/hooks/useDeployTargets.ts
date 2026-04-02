import { useQuery } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import { deployQueryKeys } from '../lib/deploy-query-keys'
import type { DeployStatus } from '../types/deploy.types'

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
  activeDeployStatus: DeployStatus | null = null,
) {
  return useQuery({
    queryKey:
      deployKey === null
        ? deployQueryKeys.all
        : deployQueryKeys.targets(deployKey, page, size, status, eqpId),
    queryFn: () => deployApi.getDeployTargets(deployKey as number, page, size, status, eqpId),
    enabled: enabled && deployKey !== null,
    refetchInterval: () => {
      if (!enabled || activeDeployStatus !== 'RUNNING') {
        return false
      }
      return 3000
    },
  })
}
