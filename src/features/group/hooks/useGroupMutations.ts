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

interface GroupPermissionVariables {
  groupId: number
  permId: number
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
 * 성공 시 User 페이지의 사용자 목록 (group chip) 과 해당 그룹의 멤버 목록을 갱신합니다.
 */
export function useAddGroupMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userPk, groupId }: MembershipVariables) => groupApi.addMember(userPk, groupId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['user'] })
      await queryClient.invalidateQueries({ queryKey: groupQueryKeys.members(variables.groupId) })
    },
  })
}

/**
 * 그룹 멤버 제거 mutation 훅입니다. (`DELETE /api/user/{userPk}/group/{groupId}`)
 * 성공 시 User 페이지의 사용자 목록 (group chip) 과 해당 그룹의 멤버 목록을 갱신합니다.
 */
export function useRemoveGroupMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userPk, groupId }: MembershipVariables) => groupApi.removeMember(userPk, groupId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['user'] })
      await queryClient.invalidateQueries({ queryKey: groupQueryKeys.members(variables.groupId) })
    },
  })
}

/**
 * 그룹에 권한을 부여하는 mutation 훅입니다. (`POST /api/group/{groupId}/permission/{permId}`)
 * 성공 시 해당 그룹의 권한 매핑 목록을 갱신합니다.
 */
export function useAddGroupPermission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ groupId, permId }: GroupPermissionVariables) =>
      groupApi.addGroupPermission(groupId, permId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: groupQueryKeys.permissions(variables.groupId) })
    },
  })
}

/**
 * 그룹 권한을 회수하는 mutation 훅입니다. (`DELETE /api/group/{groupId}/permission/{permId}`)
 * 성공 시 해당 그룹의 권한 매핑 목록을 갱신합니다.
 */
export function useRemoveGroupPermission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ groupId, permId }: GroupPermissionVariables) =>
      groupApi.removeGroupPermission(groupId, permId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: groupQueryKeys.permissions(variables.groupId) })
    },
  })
}
