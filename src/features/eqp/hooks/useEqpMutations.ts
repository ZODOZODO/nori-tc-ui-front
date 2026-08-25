import { useCallback } from 'react'
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
 *
 * <p>이 mutation 들은 모두 **접수(202)** 로 settle 한다. 접수는 완료가 아니므로 여기서 캐시를
 * 무효화하지 않는다 — 아직 반영되지 않은 서버 상태를 다시 읽어 화면이 "변경이 사라졌다" 로
 * 보이게 된다. 무효화는 operation 이 PASS 로 확정된 뒤 {@link invalidateAfterOperationPass} /
 * {@link invalidateAfterEqpDeletePass} 로 호출부가 수행한다(§14.1).</p>
 */
export function useEqpMutations() {
  const queryClient = useQueryClient()

  const createEqpMutation = useMutation({
    mutationFn: (request: EqpCreateRequest) => eqpApi.createEqp(request),
  })

  const updateEqpMutation = useMutation({
    mutationFn: ({ eqpId, request }: UpdateEqpVariables) => eqpApi.updateEqp(eqpId, request),
  })

  const deleteEqpMutation = useMutation({
    mutationFn: ({ eqpId }: DeleteEqpVariables) => eqpApi.deleteEqp(eqpId),
  })

  const startEqpMutation = useMutation({
    mutationFn: ({ eqpId, request }: LifecycleVariables) => eqpApi.startEqp(eqpId, request),
  })

  const endEqpMutation = useMutation({
    mutationFn: ({ eqpId, request }: LifecycleVariables) => eqpApi.endEqp(eqpId, request),
  })

  const reconnectEqpMutation = useMutation({
    mutationFn: ({ eqpId, request }: LifecycleVariables) => eqpApi.reconnectEqp(eqpId, request),
  })

  const startPollingGroupMutation = useMutation({
    mutationFn: ({ eqpId, groupMessageName }: PollingGroupVariables) =>
      eqpApi.startPollingGroup(eqpId, groupMessageName),
  })

  const endPollingGroupMutation = useMutation({
    mutationFn: ({ eqpId, groupMessageName }: PollingGroupVariables) =>
      eqpApi.endPollingGroup(eqpId, groupMessageName),
  })

  /** operation PASS 확정 후 설비/model 캐시를 무효화한다. */
  const invalidateAfterOperationPass = useCallback(
    (eqpId: string | null) => invalidateEqpMutationQueries(queryClient, eqpId ?? undefined),
    [queryClient],
  )

  /** 삭제 operation PASS 확정 후 캐시를 무효화하고 해당 설비 쿼리를 제거한다. */
  const invalidateAfterEqpDeletePass = useCallback(
    async (eqpId: string) => {
      await invalidateEqpMutationQueries(queryClient)
      removeEqpQueries(queryClient, eqpId)
    },
    [queryClient],
  )

  return {
    createEqpMutation,
    updateEqpMutation,
    deleteEqpMutation,
    startEqpMutation,
    endEqpMutation,
    reconnectEqpMutation,
    startPollingGroupMutation,
    endPollingGroupMutation,
    invalidateAfterOperationPass,
    invalidateAfterEqpDeletePass,
  }
}
