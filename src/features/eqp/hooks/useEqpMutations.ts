import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eqpApi } from '../api/eqp.api'
import { invalidateEqpMutationQueries, removeEqpQueries } from '../lib/eqp-query-keys'
import type { EqpCreateRequest, EqpLifecycleRequest, EqpUpdateRequest } from '../types/eqp.types'

interface UpdateEqpVariables {
  eqpId: string
  request: EqpUpdateRequest
}

interface DeleteEqpVariables {
  eqpId: string
}

interface LifecycleVariables {
  eqpId: string
  request: EqpLifecycleRequest
}

interface PollingGroupVariables {
  eqpId: string
  groupMessageName: string
}

/**
 * EQP 관련 mutation 훅 모음입니다.
 * 성공 시 목록 캐시를 무효화하여 사이드바 목록/상세를 최신 상태로 맞춥니다.
 */
export function useEqpMutations() {
  const queryClient = useQueryClient()

  const createEqpMutation = useMutation({
    mutationFn: (request: EqpCreateRequest) => eqpApi.createEqp(request),
    onSuccess: async (_, variables) => {
      await invalidateEqpMutationQueries(queryClient, variables.eqpId)
    },
  })

  const updateEqpMutation = useMutation({
    mutationFn: ({ eqpId, request }: UpdateEqpVariables) => eqpApi.updateEqp(eqpId, request),
    onSuccess: async (_, variables) => {
      await invalidateEqpMutationQueries(queryClient, variables.eqpId)
    },
  })

  const deleteEqpMutation = useMutation({
    mutationFn: ({ eqpId }: DeleteEqpVariables) => eqpApi.deleteEqp(eqpId),
    onSuccess: async (_, variables) => {
      await invalidateEqpMutationQueries(queryClient)
      removeEqpQueries(queryClient, variables.eqpId)
    },
  })

  const startEqpMutation = useMutation({
    mutationFn: ({ eqpId, request }: LifecycleVariables) => eqpApi.startEqp(eqpId, request),
    onSuccess: async () => {
      await invalidateEqpMutationQueries(queryClient)
    },
  })

  const endEqpMutation = useMutation({
    mutationFn: ({ eqpId, request }: LifecycleVariables) => eqpApi.endEqp(eqpId, request),
    onSuccess: async () => {
      await invalidateEqpMutationQueries(queryClient)
    },
  })

  const reconnectEqpMutation = useMutation({
    mutationFn: ({ eqpId, request }: LifecycleVariables) => eqpApi.reconnectEqp(eqpId, request),
    onSuccess: async () => {
      await invalidateEqpMutationQueries(queryClient)
    },
  })

  const startPollingGroupMutation = useMutation({
    mutationFn: ({ eqpId, groupMessageName }: PollingGroupVariables) =>
      eqpApi.startPollingGroup(eqpId, groupMessageName),
  })

  const endPollingGroupMutation = useMutation({
    mutationFn: ({ eqpId, groupMessageName }: PollingGroupVariables) =>
      eqpApi.endPollingGroup(eqpId, groupMessageName),
  })

  return {
    createEqpMutation,
    updateEqpMutation,
    deleteEqpMutation,
    startEqpMutation,
    endEqpMutation,
    reconnectEqpMutation,
    startPollingGroupMutation,
    endPollingGroupMutation,
  }
}
