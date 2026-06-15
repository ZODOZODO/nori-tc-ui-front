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

/**
 * 전체 UI 권한 카탈로그 조회 훅 (GET /api/permission).
 * 한 번에 조회 (권한 종류가 적다고 가정). 권한 부여/회수 UI 의 후보 목록.
 */
export function useAllPermissions(enabled = true) {
  return useQuery({
    queryKey: groupQueryKeys.permissionCatalog,
    queryFn: () => groupApi.listAllPermissions(0, 500),
    enabled,
    staleTime: 60_000,
  })
}

/**
 * 특정 그룹이 보유한 권한 매핑 조회 훅 (GET /api/group/{groupId}/permission).
 * 반환 행은 permId 기준 — 카탈로그(useAllPermissions)와 permId 로 교차해 보유 여부를 판단한다.
 */
export function useGroupPermissions(groupId: number | null, enabled = true) {
  return useQuery({
    queryKey: groupId === null ? ['group', 'permissions', 'noop'] : groupQueryKeys.permissions(groupId),
    queryFn: () => groupApi.listGroupPermissions(groupId as number, 0, 500),
    enabled: enabled && groupId !== null,
  })
}
