import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { groupApi } from '../api/group.api'
import { groupQueryKeys } from '../lib/group-query-keys'

/**
 * 그룹 목록 조회 훅 — 명시 페이지네이션 (Group 페이지 전용).
 */
export function useGroups(offset: number, limit: number, enabled = true) {
  return useQuery({
    queryKey: groupQueryKeys.list(offset, limit),
    queryFn: () => groupApi.getGroupList(offset, limit),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

/**
 * 그룹 상세 조회 훅입니다.
 */
export function useGroupDetail(groupId: number | null, enabled = true) {
  return useQuery({
    queryKey: groupId === null ? ['group', 'detail', 'noop'] : groupQueryKeys.detail(groupId),
    queryFn: () => groupApi.getGroupDetail(groupId as number),
    enabled: enabled && groupId !== null,
  })
}

/**
 * 특정 그룹에 속한 멤버 목록 조회 훅입니다 (GET /api/group/{groupId}/user).
 *
 * limit=500 으로 한 번에 조회 — 한 그룹의 멤버 수가 적다고 가정합니다.
 */
export function useGroupMembers(groupId: number | null, enabled = true) {
  return useQuery({
    queryKey: groupId === null ? ['group', 'members', 'noop'] : groupQueryKeys.members(groupId),
    queryFn: () => groupApi.listMembers(groupId as number, 0, 500),
    enabled: enabled && groupId !== null,
  })
}
