import { useMutation, useQueryClient } from '@tanstack/react-query'
import { groupApi } from '../api/group.api'
import { groupQueryKeys } from '../lib/group-query-keys'
import type { GroupUpsertRequest } from '../types/group.types'

interface UpdateGroupVariables {
  groupId: number
  request: GroupUpsertRequest
}

interface MembershipVariables {
  userPk: number
  groupId: number
}

/**
 * 그룹 신규 생성 mutation 입니다.
 */
export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: GroupUpsertRequest) => groupApi.createGroup(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: groupQueryKeys.all })
    },
  })
}

/**
 * 그룹 수정 mutation 훅입니다.
 */
export function useUpdateGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ groupId, request }: UpdateGroupVariables) => groupApi.updateGroup(groupId, request),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: groupQueryKeys.detail(variables.groupId) })
      await queryClient.invalidateQueries({ queryKey: groupQueryKeys.all })
    },
  })
}

/**
 * 그룹 삭제 mutation 훅입니다.
 */
export function useDeleteGroup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (groupId: number) => groupApi.deleteGroup(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: groupQueryKeys.all })
    },
  })
}

/**
 * 그룹 멤버 추가 mutation 훅입니다. (`POST /api/user/{userPk}/group/{groupId}`)
 * user feature 의 useAddUserGroup 와 동일 엔드포인트이나 호출처(Group 페이지) 분리를 위해
 * Group 도메인에서 별도 훅으로 노출합니다.
 */
export function useAddGroupMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userPk, groupId }: MembershipVariables) => groupApi.addMember(userPk, groupId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['user', 'groups', variables.userPk] })
    },
  })
}

/**
 * 그룹 멤버 제거 mutation 훅입니다. (`DELETE /api/user/{userPk}/group/{groupId}`)
 */
export function useRemoveGroupMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userPk, groupId }: MembershipVariables) => groupApi.removeMember(userPk, groupId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['user', 'groups', variables.userPk] })
    },
  })
}
