import { useQuery } from '@tanstack/react-query'
import { profileApi } from '../api/profile.api'

/**
 * 인증 사용자 정보 조회 훅입니다.
 */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => profileApi.getMe(),
    enabled,
  })
}

/**
 * 기존 호출처(UserProfileModal, DeployMonitorPanel) 호환을 위해 user 모듈 훅을 그대로 재노출합니다.
 * 새 코드는 `@/features/user/hooks/...` 에서 직접 import 해 주세요.
 *
 * `useUsers` 는 구 동작(limit=500 자동 페이지네이션) 을 그대로 유지해야 하는
 * 호출처(DeployMonitorPanel 의 멘션/필터 옵션) 호환용 alias 입니다.
 * User 페이지 신규 코드는 `useUsers(offset, limit)` 또는 `useAllUsers()` 를 직접 호출합니다.
 */
export { useUserDetail, useAllUsers as useUsers } from '@/features/user/hooks/useUsers'
export { useUpdateUser, useResetPassword } from '@/features/user/hooks/useUserMutations'
