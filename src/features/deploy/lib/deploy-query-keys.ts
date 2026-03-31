import type { DeployMonitorFilters, DeployRegisterFilters } from '../types/deploy.types'

/**
 * Deploy 도메인 query key 규약입니다.
 * register 검색은 필터 값 + 검색 시도 revision 단위로 캐시를 분리합니다.
 */
export const deployQueryKeys = {
  all: ['deploy'] as const,
  registerTargets: (
    filters: DeployRegisterFilters,
    searchRevision: number,
    offset = 0,
    limit = 500,
  ) =>
    [
      'deploy',
      'register-targets',
      filters.modelName,
      filters.modelVersionKey,
      filters.eqpId,
      searchRevision,
      offset,
      limit,
    ] as const,
  history: (
    filters: DeployMonitorFilters,
    terminalOnly: boolean,
    offset = 0,
    limit = 50,
  ) =>
    [
      'deploy',
      'history',
      filters.modelName,
      filters.requestedBy,
      filters.fromDate,
      filters.toDate,
      terminalOnly,
      offset,
      limit,
    ] as const,
  summary: (deployKey: number) => ['deploy', 'summary', deployKey] as const,
  scenarios: (eventType: string) => ['deploy', 'scenarios', eventType] as const,
  targets: (
    deployKey: number,
    page = 0,
    size = 50,
    status: string | null = null,
    eqpId: string | null = null,
  ) => ['deploy', 'targets', deployKey, page, size, status, eqpId] as const,
} as const
