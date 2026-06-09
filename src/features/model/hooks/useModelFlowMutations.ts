import { useMutation, useQueryClient } from '@tanstack/react-query'
import { modelFlowApi } from '../api/model-flow.api'
import { invalidateModelFlowQueries } from '../lib/model-query-keys'
import type {
  ModelFlowCreateRequest,
  ModelFlowUpdateRequest,
} from '../types/model.types'

interface UpdateFlowVariables {
  flowId: number
  request: ModelFlowUpdateRequest
}

/**
 * Message Flow 관련 mutation 훅 모음입니다.
 *
 * - create: 신규 Flow 생성 후 목록 캐시 무효화
 * - update: 4 섹션 갱신 후 목록 + 해당 flowDetail 캐시 무효화
 *
 * 400 / 404 / 409 에러는 ModelApiError 형태로 그대로 호출자에 전파하여
 * 화면에서 inline 메시지로 표시할 수 있도록 합니다.
 */
export function useModelFlowMutations(modelVersionKey: number | null) {
  const queryClient = useQueryClient()

  const createFlowMutation = useMutation({
    mutationFn: (request: ModelFlowCreateRequest) => {
      if (modelVersionKey === null) {
        // eslint-disable-next-line i18next/no-literal-string -- 개발자용 불변식 가드(프로그래밍 에러), 사용자 비노출이라 번역 비대상
        throw new Error('modelVersionKey 가 지정되지 않았습니다.')
      }
      return modelFlowApi.create(modelVersionKey, request)
    },
    onSuccess: async () => {
      if (modelVersionKey !== null) {
        await invalidateModelFlowQueries(queryClient, modelVersionKey)
      }
    },
  })

  const updateFlowMutation = useMutation({
    mutationFn: ({ flowId, request }: UpdateFlowVariables) => {
      if (modelVersionKey === null) {
        // eslint-disable-next-line i18next/no-literal-string -- 개발자용 불변식 가드(프로그래밍 에러), 사용자 비노출이라 번역 비대상
        throw new Error('modelVersionKey 가 지정되지 않았습니다.')
      }
      return modelFlowApi.update(modelVersionKey, flowId, request)
    },
    onSuccess: async () => {
      if (modelVersionKey !== null) {
        await invalidateModelFlowQueries(queryClient, modelVersionKey)
      }
    },
  })

  const deleteFlowMutation = useMutation({
    mutationFn: (flowId: number) => {
      if (modelVersionKey === null) {
        // eslint-disable-next-line i18next/no-literal-string -- 개발자용 불변식 가드(프로그래밍 에러), 사용자 비노출이라 번역 비대상
        throw new Error('modelVersionKey 가 지정되지 않았습니다.')
      }
      return modelFlowApi.remove(modelVersionKey, flowId)
    },
    onSuccess: async () => {
      if (modelVersionKey !== null) {
        await invalidateModelFlowQueries(queryClient, modelVersionKey)
      }
    },
  })

  return {
    createFlowMutation,
    updateFlowMutation,
    deleteFlowMutation,
  }
}
