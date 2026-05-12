import { useQuery } from '@tanstack/react-query'
import { userApi } from '../api/user.api'
import { userQueryKeys } from '../lib/user-query-keys'

/**
 * 사용자 목록 조회 훅 — 명시 페이지네이션 (User 페이지 전용).
 */
export function useUsers(offset: number, limit: number, enabled = true) {
  return useQuery({
    queryKey: userQueryKeys.list(offset, limit),
    queryFn: () => userApi.getUserList(offset, limit),
    enabled,
    staleTime: 30_000,
  })
}

/**
 * 멘션 자동완성 등에서 사용하는 전체 사용자 목록 훅입니다.
 * profile 영역에서 가지고 있던 limit=500 자동 페이지네이션 동작을 그대로 유지합니다.
 */
export function useAllUsers(enabled = true) {
  return useQuery({
    queryKey: userQueryKeys.allList,
    queryFn: () => userApi.getAllUsers(),
    enabled,
    staleTime: 60_000,
  })
}

/**
 * 사용자 상세 조회 훅입니다.
 */
export function useUserDetail(userPk: number | null, enabled = true) {
  return useQuery({
    queryKey: userPk === null ? ['user', 'detail', 'noop'] : userQueryKeys.detail(userPk),
    queryFn: () => userApi.getUserDetail(userPk as number),
    enabled: enabled && userPk !== null,
  })
}
