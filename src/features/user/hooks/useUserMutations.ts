import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/user.api'
import { userQueryKeys } from '../lib/user-query-keys'
import type {
  UserCreateRequest,
  UserPasswordResetRequest,
  UserUpdateRequest,
} from '../types/user.types'

interface UpdateUserVariables {
  userPk: number
  request: UserUpdateRequest
}

interface ResetPasswordVariables {
  userPk: number
  request: UserPasswordResetRequest
}

/**
 * 사용자 신규 생성 mutation 입니다.
 */
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UserCreateRequest) => userApi.createUser(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
    },
  })
}

/**
 * 사용자 저장 mutation 훅입니다.
 * 저장 성공 시 사용자 상세/현재 사용자 캐시를 갱신합니다.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userPk, request }: UpdateUserVariables) => userApi.updateUser(userPk, request),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.detail(variables.userPk) })
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}

/**
 * 사용자 삭제 mutation 훅입니다.
 */
export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userPk: number) => userApi.deleteUser(userPk),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.all })
    },
  })
}

/**
 * 비밀번호 변경 mutation 훅입니다.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: ({ userPk, request }: ResetPasswordVariables) =>
      userApi.resetPassword(userPk, request),
  })
}
