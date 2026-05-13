import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { deployApi } from '../api/deploy.api'
import { deployQueryKeys } from '../lib/deploy-query-keys'
import type { DeployMonitorFilters } from '../types/deploy.types'

/**
 * Deploy / Deploy_History 목록을 서버에서 조회합니다.
 */
export function useDeployHistoryList(
  filters: DeployMonitorFilters,
  terminalOnly: boolean,
  offset = 0,
  limit = 50,
) {
  return useQuery({
    queryKey: deployQueryKeys.history(filters, terminalOnly, offset, limit),
    queryFn: () => deployApi.getDeployHistory(filters, terminalOnly, offset, limit),
    refetchInterval: terminalOnly ? false : 3000,
    placeholderData: keepPreviousData,
  })
}
