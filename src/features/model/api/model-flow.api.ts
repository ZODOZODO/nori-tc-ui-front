import { isAxiosError } from 'axios'
import { apiClient } from '@/shared/lib/api-client'
import {
  createModelFailResponse,
  DEFAULT_MODEL_ERROR_MESSAGE,
  ModelApiError,
  type ModelFlow,
  type ModelFlowCreateRequest,
  type ModelFlowCreatedData,
  type ModelFlowCreatedResponse,
  type ModelFlowDetailResponse,
  type ModelFlowListPayload,
  type ModelFlowListResponse,
  type ModelFlowUpdateRequest,
  isApiResponse,
} from '../types/model.types'

const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'
const FLOW_LIST_FALLBACK_MESSAGE = 'Message Flow 목록을 조회하지 못했습니다.'
const FLOW_DETAIL_FALLBACK_MESSAGE = 'Message Flow 상세를 조회하지 못했습니다.'
const FLOW_CREATE_FALLBACK_MESSAGE = 'Message Flow 생성에 실패했습니다.'
const FLOW_UPDATE_FALLBACK_MESSAGE = 'Message Flow 수정에 실패했습니다.'

/**
 * document.cookie 에서 특정 쿠키 값을 추출합니다.
 * model.api.ts 의 동일 헬퍼와 같은 구현이지만, 모듈 경계 분리를 위해 로컬 복제합니다.
 */
const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }

  const encodedName = `${encodeURIComponent(name)}=`
  const matchedCookie = document.cookie
    .split('; ')
    .find((cookieEntry) => cookieEntry.startsWith(encodedName))

  if (!matchedCookie) {
    return null
  }

  return decodeURIComponent(matchedCookie.substring(encodedName.length))
}

/**
 * 상태 변경 요청 전에 CSRF 토큰을 발급합니다.
 */
const issueCsrfToken = async (): Promise<string> => {
  await apiClient.get('/auth/csrf', { withCredentials: true })
  const csrfToken = getCookieValue(CSRF_COOKIE_NAME)
  if (!csrfToken) {
    throw new ModelApiError(
      createModelFailResponse({
        success: false,
        data: null,
        errorCode: 'CSRF_TOKEN_MISSING',
        errorMsg: 'CSRF 토큰을 확인할 수 없습니다. 페이지를 새로고침한 후 다시 시도해 주세요.',
      }),
    )
  }
  return csrfToken
}

/**
 * 알 수 없는 예외를 ModelApiError 로 정규화합니다.
 */
const normalizeModelError = (
  error: unknown,
  fallbackMessage = DEFAULT_MODEL_ERROR_MESSAGE,
): ModelApiError => {
  if (error instanceof ModelApiError) {
    return error
  }

  if (isAxiosError(error)) {
    return new ModelApiError(
      createModelFailResponse(error.response?.data, fallbackMessage),
      error.response?.status,
    )
  }

  return new ModelApiError(createModelFailResponse(error, fallbackMessage))
}

/**
 * ApiResponse 계약을 검증하고 성공 payload(data) 를 반환합니다.
 */
const resolveSuccessPayload = <TData>(
  payload: unknown,
  status: number,
  fallbackMessage: string,
): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true) {
    throw new ModelApiError(createModelFailResponse(payload, fallbackMessage), status)
  }

  if (payload.data === null) {
    throw new ModelApiError(
      createModelFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: fallbackMessage,
        },
        fallbackMessage,
      ),
      status,
    )
  }

  return payload.data as TData
}

/**
 * CSRF 헤더가 필요한 요청을 공통 처리합니다.
 */
const withCsrfHeaders = async <TResponse>(
  requestFn: (csrfToken: string) => Promise<TResponse>,
): Promise<TResponse> => {
  const csrfToken = await issueCsrfToken()
  return requestFn(csrfToken)
}

export const modelFlowApi = {
  /**
   * Message Flow 목록을 조회합니다 (workflow_key ASC).
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
        FLOW_LIST_FALLBACK_MESSAGE,
      )
    } catch (error) {
      throw normalizeModelError(error, FLOW_LIST_FALLBACK_MESSAGE)
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
        FLOW_DETAIL_FALLBACK_MESSAGE,
      )
    } catch (error) {
      throw normalizeModelError(error, FLOW_DETAIL_FALLBACK_MESSAGE)
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
        FLOW_CREATE_FALLBACK_MESSAGE,
      )
    } catch (error) {
      throw normalizeModelError(error, FLOW_CREATE_FALLBACK_MESSAGE)
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
        FLOW_UPDATE_FALLBACK_MESSAGE,
      )
    } catch (error) {
      throw normalizeModelError(error, FLOW_UPDATE_FALLBACK_MESSAGE)
    }
  },
}
