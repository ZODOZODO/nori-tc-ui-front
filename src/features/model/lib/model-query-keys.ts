import type { QueryClient } from '@tanstack/react-query'
import type { ModelDetailNode } from '../types/model.types'

/**
 * Model 도메인 query key 규약입니다.
 * 상세/탭/branch 관리 기능이 같은 캐시 키를 공유하도록 중앙에서 정의합니다.
 */
export const modelQueryKeys = {
  all: ['model'] as const,
  list: () => ['model', 'list'] as const,
  detailRoot: () => ['model', 'detail'] as const,
  detail: (modelVersionKey: number | null) => ['model', 'detail', modelVersionKey] as const,
  detailNodeRoot: () => ['model', 'detail-node'] as const,
  detailNode: (modelVersionKey: number | null, detailNode: ModelDetailNode | null) =>
    ['model', 'detail-node', modelVersionKey, detailNode] as const,
  parentCommit: (modelKey: number | null) => ['model', 'parent-commit', modelKey] as const,
  flowsRoot: () => ['model', 'flows'] as const,
  flows: (modelVersionKey: number | null) => ['model', 'flows', modelVersionKey] as const,
  flowDetail: (modelVersionKey: number | null, flowId: number | null) =>
    ['model', 'flow-detail', modelVersionKey, flowId] as const,
} as const

/**
 * 단일 modelVersionKey 의 Flow 목록 / 상세 캐시를 모두 무효화합니다.
 * Flow 생성·수정 직후 화면 동기화에 사용합니다.
 */
export const invalidateModelFlowQueries = async (
  queryClient: QueryClient,
  modelVersionKey: number,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: modelQueryKeys.flows(modelVersionKey) }),
    queryClient.invalidateQueries({
      queryKey: ['model', 'flow-detail', modelVersionKey] as const,
    }),
  ])
}

/**
 * Model 목록/상세/탭 데이터를 함께 무효화합니다.
 * branch 생성/commit/delete처럼 tree와 detail이 동시에 바뀌는 작업에 사용합니다.
 */
export const invalidateModelTreeQueries = async (queryClient: QueryClient): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: modelQueryKeys.list() }),
    queryClient.invalidateQueries({ queryKey: modelQueryKeys.detailRoot() }),
    queryClient.invalidateQueries({ queryKey: modelQueryKeys.detailNodeRoot() }),
  ])
}

/**
 * 단일 modelVersionKey의 상세/상세노드 캐시를 무효화합니다.
 */
export const invalidateModelVersionQueries = async (
  queryClient: QueryClient,
  modelVersionKey: number,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: modelQueryKeys.detail(modelVersionKey) }),
    queryClient.invalidateQueries({
      queryKey: ['model', 'detail-node', modelVersionKey] as const,
    }),
  ])
}

/**
 * 삭제된 modelVersionKey의 상세 캐시를 제거합니다.
 */
export const removeModelVersionQueries = (
  queryClient: QueryClient,
  modelVersionKey: number,
): void => {
  queryClient.removeQueries({ queryKey: modelQueryKeys.detail(modelVersionKey) })
  queryClient.removeQueries({
    queryKey: ['model', 'detail-node', modelVersionKey] as const,
  })
}
