import i18n from '@/i18n'
import { apiClient } from '@/shared/lib/api-client'
import { assertSuccessResponse, normalizeApiError, resolveSuccessPayload } from '@/shared/lib/api-error'
import { CSRF_HEADER_NAME, withCsrfHeaders } from '@/shared/lib/csrf'
import {
  type ApiResponse,
  type ModelFlow,
  type ModelFlowCreateRequest,
  type ModelFlowCreatedData,
  type ModelFlowCreatedResponse,
  type ModelFlowDetailResponse,
  type ModelFlowListPayload,
  type ModelFlowListResponse,
  type ModelFlowUpdateRequest,
} from '../types/model.types'

// 모듈 로드 시점이 아니라 호출 시점에 i18n.t 를 평가해야 런타임 언어 전환을 반영한다.
const flowListFallbackMessage = (): string => i18n.t('error.model.flowList')
const flowDetailFallbackMessage = (): string => i18n.t('error.model.flowDetail')
const flowCreateFallbackMessage = (): string => i18n.t('error.model.flowCreate')
const flowUpdateFallbackMessage = (): string => i18n.t('error.model.flowUpdate')
const flowDeleteFallbackMessage = (): string => i18n.t('error.model.flowDelete')

export const modelFlowApi = {
  /**
   * Message Flow 목록을 조회합니다 (message_flow_key ASC, backend flowId).
   */
  list: async (modelVersionKey: number): Promise<ModelFlowListPayload> => {
    try {
      const response = await apiClient.get<ModelFlowListResponse>(
        `/model/${modelVersionKey}/flows`,
        { withCredentials: true },
      )

      return resolveSuccessPayload<ModelFlowListPayload>(
        response.data,
        response.status,
        flowListFallbackMessage(),
      )
    } catch (error) {
      throw normalizeApiError(error, flowListFallbackMessage())
    }
  },

  /**
   * Message Flow 4 섹션 상세를 조회합니다.
   */
  detail: async (modelVersionKey: number, flowId: number): Promise<ModelFlow> => {
    try {
      const response = await apiClient.get<ModelFlowDetailResponse>(
        `/model/${modelVersionKey}/flows/${flowId}`,
        { withCredentials: true },
      )

      return resolveSuccessPayload<ModelFlow>(
        response.data,
        response.status,
        flowDetailFallbackMessage(),
      )
    } catch (error) {
      throw normalizeApiError(error, flowDetailFallbackMessage())
    }
  },

  /**
   * 신규 Message Flow 를 생성합니다 (Identity 섹션만).
   */
  create: async (
    modelVersionKey: number,
    request: ModelFlowCreateRequest,
  ): Promise<ModelFlowCreatedData> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<ModelFlowCreatedResponse>(
          `/model/${modelVersionKey}/flows`,
          request,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      return resolveSuccessPayload<ModelFlowCreatedData>(
        response.data,
        response.status,
        flowCreateFallbackMessage(),
      )
    } catch (error) {
      throw normalizeApiError(error, flowCreateFallbackMessage())
    }
  },

  /**
   * 기존 Message Flow 의 4 섹션을 갱신합니다.
   * 응답은 갱신 후 재조회된 상세입니다.
   */
  update: async (
    modelVersionKey: number,
    flowId: number,
    request: ModelFlowUpdateRequest,
  ): Promise<ModelFlow> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<ModelFlowDetailResponse>(
          `/model/${modelVersionKey}/flows/${flowId}`,
          request,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      return resolveSuccessPayload<ModelFlow>(
        response.data,
        response.status,
        flowUpdateFallbackMessage(),
      )
    } catch (error) {
      throw normalizeApiError(error, flowUpdateFallbackMessage())
    }
  },

  /**
   * 단일 Message Flow 를 삭제합니다 (Collect 바인딩 포함, 응답 본문 없음).
   */
  remove: async (modelVersionKey: number, flowId: number): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<ApiResponse<null>>(
          `/model/${modelVersionKey}/flows/${flowId}`,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      assertSuccessResponse(response.data, response.status, flowDeleteFallbackMessage())
    } catch (error) {
      throw normalizeApiError(error, flowDeleteFallbackMessage())
    }
  },
}
