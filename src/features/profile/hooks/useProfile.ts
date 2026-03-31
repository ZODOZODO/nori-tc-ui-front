import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { profileApi } from '../api/profile.api'
import type { UserPasswordResetRequest, UserUpdateRequest } from '../types/profile.types'

interface UpdateUserVariables {
  userPk: number
  request: UserUpdateRequest
}

interface ResetPasswordVariables {
  userPk: number
  request: UserPasswordResetRequest
}

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
 * 사용자 상세 조회 훅입니다.
 */
export function useUserDetail(userPk: number | null, enabled = true) {
  return useQuery({
    queryKey: ['user', userPk],
    queryFn: () => profileApi.getUserDetail(userPk as number),
    enabled: enabled && userPk !== null,
  })
}

/**
 * 사용자 목록 조회 훅입니다.
 */
export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ['user', 'list'],
    queryFn: () => profileApi.getAllUsers(),
    enabled,
    staleTime: 60_000,
  })
}

/**
 * 사용자 저장 mutation 훅입니다.
 * 저장 성공 시 사용자 상세/현재 사용자 캐시를 갱신합니다.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userPk, request }: UpdateUserVariables) => profileApi.updateUser(userPk, request),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['user', variables.userPk] })
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

/**
 * 비밀번호 변경 mutation 훅입니다.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: ({ userPk, request }: ResetPasswordVariables) =>
      profileApi.resetPassword(userPk, request),
  })
}
