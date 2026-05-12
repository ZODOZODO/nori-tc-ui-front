import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userApi } from '../api/user.api'
import { userQueryKeys } from '../lib/user-query-keys'

interface UserGroupVariables {
  userPk: number
  groupId: number
}

/**
 * 특정 사용자가 소속된 그룹 목록을 조회합니다.
 */
export function useUserGroups(userPk: number | null, enabled = true) {
  return useQuery({
    queryKey: userPk === null ? ['user', 'groups', 'noop'] : userQueryKeys.groups(userPk),
    queryFn: () => userApi.listUserGroups(userPk as number),
    enabled: enabled && userPk !== null,
  })
}

/**
 * 사용자에게 그룹을 추가합니다.
 */
export function useAddUserGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userPk, groupId }: UserGroupVariables) =>
      userApi.addUserGroup(userPk, groupId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.groups(variables.userPk) })
    },
  })
}

/**
 * 사용자의 그룹을 제거합니다.
 */
export function useRemoveUserGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userPk, groupId }: UserGroupVariables) =>
      userApi.removeUserGroup(userPk, groupId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: userQueryKeys.groups(variables.userPk) })
    },
  })
}
