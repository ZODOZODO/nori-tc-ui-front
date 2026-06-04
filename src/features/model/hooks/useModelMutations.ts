import { useMutation, useQueryClient } from '@tanstack/react-query'
import i18n from '@/i18n'
import { modelApi } from '../api/model.api'
import {
  invalidateModelTreeQueries,
  invalidateModelVersionQueries,
  modelQueryKeys,
  removeModelVersionQueries,
} from '../lib/model-query-keys'
import {
  createModelFailResponse,
  ModelApiError,
  type ModelInfo,
  type ModelPageResponse,
  type ModelUpsertRequest,
} from '../types/model.types'

const EDIT_MODEL_VERSION = 'EDIT'

interface UpdateModelVariables {
  modelVersionKey: number
  request: ModelUpsertRequest
}

interface DeleteModelVariables {
  modelVersionKey: number
}

interface CheckoutModelVariables {
  model: ModelInfo
  currentUserId: string | null
}

interface CheckinModelVariables {
  editModel: ModelInfo
  description: string
  currentUserId: string | null
}

/**
 * 모델 버전 문자열이 EDIT 잠금 버전인지 확인합니다.
 */
const isEditVersion = (modelVersion: string): boolean =>
  modelVersion.trim().toUpperCase() === EDIT_MODEL_VERSION

/**
 * 체크아웃 소유자 표시에 사용할 사용자 ID를 추출합니다.
 */
const resolveLockOwner = (model: ModelInfo): string | null => {
  const normalizedUpdatedBy = model.updatedBy.trim()
  if (normalizedUpdatedBy.length > 0) {
    return normalizedUpdatedBy
  }

  const normalizedCreatedBy = model.createdBy.trim()
  if (normalizedCreatedBy.length > 0) {
    return normalizedCreatedBy
  }

  return null
}

/**
 * 다른 사용자가 EDIT 잠금을 점유한 경우를 표현하는 전용 에러를 생성합니다.
 */
const createCheckoutConflictError = (owner: string | null): ModelApiError =>
  new ModelApiError(
    createModelFailResponse({
      success: false,
      data: null,
      errorCode: 'CHECKOUT_CONFLICT',
      errorMsg: owner
        ? i18n.t('error.model.checkoutConflictBy', { owner })
        : i18n.t('error.model.checkoutConflict'),
    }),
    409,
  )

/**
 * Model 관련 mutation 훅 모음입니다.
 *
 * 체크아웃/체크인은 현재 백엔드 CRUD 계약을 조합해 동작합니다.
 * - checkout: 동일 modelKey의 EDIT 버전이 없으면 현재 상세 스냅샷을 복제한 EDIT 버전을 생성
 * - checkin: EDIT 상세 스냅샷을 새 버전으로 복제한 뒤 EDIT 버전을 삭제
 */
export function useModelMutations() {
  const queryClient = useQueryClient()

  const refreshModelItems = async (): Promise<ModelInfo[]> => {
    const remotePage = await modelApi.getModelList(0, 500)
    queryClient.setQueryData<ModelPageResponse>(modelQueryKeys.list(), remotePage)
    return remotePage.items
  }

  const findEditModel = (modelItems: ModelInfo[], modelKey: number): ModelInfo | null =>
    modelItems.find((item) => item.modelKey === modelKey && isEditVersion(item.modelVersion)) ?? null

  const createModelMutation = useMutation({
    mutationFn: (request: ModelUpsertRequest) => modelApi.createModel(request),
    onSuccess: async (createdModel) => {
      await invalidateModelTreeQueries(queryClient)
      await invalidateModelVersionQueries(queryClient, createdModel.modelVersionKey)
    },
  })

  const updateModelMutation = useMutation({
    mutationFn: ({ modelVersionKey, request }: UpdateModelVariables) =>
      modelApi.updateModel(modelVersionKey, request),
    onSuccess: async (_, variables) => {
      await invalidateModelTreeQueries(queryClient)
      await invalidateModelVersionQueries(queryClient, variables.modelVersionKey)
    },
  })

  const deleteModelMutation = useMutation({
    mutationFn: ({ modelVersionKey }: DeleteModelVariables) => modelApi.deleteModel(modelVersionKey),
    onSuccess: async (_, variables) => {
      await invalidateModelTreeQueries(queryClient)
      removeModelVersionQueries(queryClient, variables.modelVersionKey)
    },
  })

  const checkoutModelMutation = useMutation({
    mutationFn: async ({ model, currentUserId }: CheckoutModelVariables) => {
      const modelItems = await refreshModelItems()
      const existingEditModel = findEditModel(modelItems, model.modelKey)

      if (existingEditModel) {
        const lockOwner = resolveLockOwner(existingEditModel)
        if (lockOwner && currentUserId && lockOwner !== currentUserId) {
          throw createCheckoutConflictError(lockOwner)
        }
        if (lockOwner && !currentUserId) {
          throw createCheckoutConflictError(lockOwner)
        }
        return existingEditModel
      }

      try {
        return await modelApi.checkoutModelVersion(model.modelVersionKey)
      } catch (error) {
        if (error instanceof ModelApiError && error.status === 409) {
          const latestModelItems = await refreshModelItems()
          const conflictingEditModel = findEditModel(latestModelItems, model.modelKey)

          if (conflictingEditModel) {
            const lockOwner = resolveLockOwner(conflictingEditModel)
            if (lockOwner && currentUserId && lockOwner === currentUserId) {
              return conflictingEditModel
            }

            throw createCheckoutConflictError(lockOwner)
          }
        }

        throw error
      }
    },
    onSuccess: async (checkedOutModel, variables) => {
      await invalidateModelTreeQueries(queryClient)
      await invalidateModelVersionQueries(queryClient, variables.model.modelVersionKey)
      await invalidateModelVersionQueries(queryClient, checkedOutModel.modelVersionKey)
    },
  })

  const checkinModelMutation = useMutation({
    mutationFn: async ({ editModel, description, currentUserId }: CheckinModelVariables) => {
      const lockOwner = resolveLockOwner(editModel)
      if (
        isEditVersion(editModel.modelVersion) &&
        lockOwner &&
        (!currentUserId || lockOwner !== currentUserId)
      ) {
        throw createCheckoutConflictError(lockOwner)
      }
      return modelApi.checkinModelVersion(editModel.modelVersionKey, {
        description: description.trim(),
      })
    },
    onSuccess: async (createdModel, variables) => {
      await invalidateModelTreeQueries(queryClient)
      await invalidateModelVersionQueries(queryClient, createdModel.modelVersionKey)
      removeModelVersionQueries(queryClient, variables.editModel.modelVersionKey)
    },
  })

  return {
    createModelMutation,
    updateModelMutation,
    deleteModelMutation,
    checkoutModelMutation,
    checkinModelMutation,
  }
}
