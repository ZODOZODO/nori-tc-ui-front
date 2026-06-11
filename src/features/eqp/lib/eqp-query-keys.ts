import type { QueryClient } from '@tanstack/react-query'

/**
 * EQP 도메인 query key 규약입니다.
 * 관리 화면/상세 화면이 같은 키 체계를 공유하도록 중앙에서 정의합니다.
 */
export const eqpQueryKeys = {
  all: ['eqp'] as const,
  list: () => ['eqp', 'list'] as const,
  gatewayShardLeases: () => ['eqp', 'gateway-shard-leases'] as const,
  detail: (eqpId: string | null) => ['eqp', 'detail', eqpId] as const,
  manage: (eqpId: string | null) => ['eqp', 'manage', eqpId] as const,
  manageBatch: (eqpIds: readonly string[]) => ['eqp', 'manage-batch', [...eqpIds].sort()] as const,
  manageOptions: () => ['eqp', 'manage-options'] as const,
  modelInfo: (modelVersionKey: number | null) => ['eqp', 'modelInfo', modelVersionKey] as const,
  runtimeState: (eqpId: string | null) => ['eqp', 'runtimeState', eqpId] as const,
  paramVersions: (eqpId: string | null) => ['eqp', 'paramVersions', eqpId] as const,
  checkoutStatus: (eqpId: string | null) => ['eqp', 'checkoutStatus', eqpId] as const,
  paramsRoot: (eqpId: string | null) => ['eqp', 'params', eqpId] as const,
  params: (eqpId: string | null, version: string | null) => ['eqp', 'params', eqpId, version] as const,
} as const

/**
 * 선택된 EQP의 상세/런타임/파라미터/관리 캐시를 함께 무효화합니다.
 */
export const invalidateEqpSelectionQueries = async (
  queryClient: QueryClient,
  eqpId: string,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: eqpQueryKeys.detail(eqpId) }),
    queryClient.invalidateQueries({ queryKey: eqpQueryKeys.manage(eqpId) }),
    queryClient.invalidateQueries({ queryKey: eqpQueryKeys.runtimeState(eqpId) }),
    queryClient.invalidateQueries({ queryKey: eqpQueryKeys.paramVersions(eqpId) }),
    queryClient.invalidateQueries({ queryKey: eqpQueryKeys.checkoutStatus(eqpId) }),
    queryClient.invalidateQueries({ queryKey: eqpQueryKeys.paramsRoot(eqpId) }),
  ])
}

/**
 * EQP create/update/delete 이후 공통적으로 필요한 캐시 무효화 범위를 정의합니다.
 */
export const invalidateEqpMutationQueries = async (
  queryClient: QueryClient,
  eqpId?: string,
): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: eqpQueryKeys.list() })

  if (eqpId) {
    await invalidateEqpSelectionQueries(queryClient, eqpId)
  }

  await queryClient.invalidateQueries({ queryKey: eqpQueryKeys.manageOptions() })
}

/**
 * 삭제된 EQP의 개별 캐시를 제거합니다.
 */
export const removeEqpQueries = (queryClient: QueryClient, eqpId: string): void => {
  queryClient.removeQueries({ queryKey: eqpQueryKeys.detail(eqpId) })
  queryClient.removeQueries({ queryKey: eqpQueryKeys.manage(eqpId) })
  queryClient.removeQueries({ queryKey: eqpQueryKeys.runtimeState(eqpId) })
  queryClient.removeQueries({ queryKey: eqpQueryKeys.paramVersions(eqpId) })
  queryClient.removeQueries({ queryKey: eqpQueryKeys.checkoutStatus(eqpId) })
  queryClient.removeQueries({ queryKey: eqpQueryKeys.paramsRoot(eqpId) })
}
