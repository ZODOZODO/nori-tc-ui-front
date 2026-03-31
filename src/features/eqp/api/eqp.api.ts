import { isAxiosError } from 'axios'
import { apiClient } from '@/shared/lib/api-client'
import {
  createEqpFailResponse,
  DEFAULT_EQP_ERROR_MESSAGE,
  EqpApiError,
  type AsyncAcceptResponse,
  type AsyncResultData,
  type AsyncResultResponse,
  type EqpCheckinRequest,
  type EqpCheckoutRequest,
  type EqpCheckoutStatus,
  type EqpCheckoutStatusResponse,
  type EqpCreateRequest,
  type EqpDualCommandResponse,
  type EqpInfo,
  type EqpInfoDetailResponse,
  type EqpInfoListResponse,
  type EqpManageDetail,
  type EqpManageDetailResponse,
  type EqpManageOptions,
  type EqpManageOptionsResponse,
  type EqpModelInfo,
  type EqpModelInfoResponse,
  type EqpInfoPage,
  type EqpLifecycleRequest,
  type EqpParam,
  type EqpParamListResponse,
  type EqpParamSaveItem,
  type EqpParamVersionListResponse,
  type EqpRuntimeState,
  type EqpRuntimeStateResponse,
  type EqpUpdateRequest,
  isApiResponse,
  isRecord,
} from '../types/eqp.types'

const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'
const EQP_LIST_FALLBACK_MESSAGE = '설비 목록을 조회하지 못했습니다.'

/**
 * document.cookie에서 특정 쿠키 값을 추출합니다.
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
 * 상태 변경 요청 이전에 CSRF 토큰을 발급하고 헤더 값을 반환합니다.
 */
const issueCsrfToken = async (): Promise<string> => {
  await apiClient.get('/auth/csrf', {
    withCredentials: true,
  })

  const csrfToken = getCookieValue(CSRF_COOKIE_NAME)
  if (!csrfToken) {
    throw new EqpApiError(
      createEqpFailResponse({
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
 * 알 수 없는 예외를 EqpApiError로 정규화합니다.
 */
const normalizeEqpError = (
  error: unknown,
  fallbackMessage = DEFAULT_EQP_ERROR_MESSAGE,
): EqpApiError => {
  if (error instanceof EqpApiError) {
    return error
  }

  if (isAxiosError(error)) {
    return new EqpApiError(
      createEqpFailResponse(error.response?.data, fallbackMessage),
      error.response?.status,
    )
  }

  return new EqpApiError(createEqpFailResponse(error, fallbackMessage))
}

/**
 * ApiResponse 계약을 검증하고 성공 payload(data)를 반환합니다.
 * allowNullData=true인 경우 success=true + data=null도 성공으로 허용합니다.
 */
const resolveSuccessPayload = <TData>(
  payload: unknown,
  status: number,
  fallbackMessage: string,
  allowNullData = false,
): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true) {
    throw new EqpApiError(createEqpFailResponse(payload, fallbackMessage), status)
  }

  if (payload.data === null && !allowNullData) {
    throw new EqpApiError(
      createEqpFailResponse(
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
 * 설비 목록 항목 최소 계약(문자열 eqpId)을 만족하는지 확인합니다.
 * 서버 응답이 일부 비정상인 경우에도 UI가 치명적으로 중단되지 않도록 유효 항목만 통과시킵니다.
 */
const isEqpInfoItem = (value: unknown): value is EqpInfo =>
  isRecord(value) && typeof value.eqpId === 'string' && value.eqpId.length > 0

/**
 * 설비 목록 payload를 페이지 형식으로 정규화합니다.
 * - 표준 계약: { items, offset, limit, count }
 * - 구계약 호환: data가 배열인 경우(legacy)도 허용
 */
const normalizeEqpListPayload = (
  payload: unknown,
  requestedOffset: number,
  requestedLimit: number,
): EqpInfoPage => {
  if (Array.isArray(payload)) {
    const normalizedItems = payload.filter(isEqpInfoItem)
    return {
      items: normalizedItems,
      offset: requestedOffset,
      limit: requestedLimit,
      count: normalizedItems.length,
    }
  }

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new EqpApiError(
      createEqpFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: EQP_LIST_FALLBACK_MESSAGE,
        },
        EQP_LIST_FALLBACK_MESSAGE,
      ),
    )
  }

  const normalizedItems = payload.items.filter(isEqpInfoItem)
  const resolvedOffset = typeof payload.offset === 'number' ? payload.offset : requestedOffset
  const resolvedLimit = typeof payload.limit === 'number' ? payload.limit : requestedLimit
  const resolvedCount =
    typeof payload.count === 'number'
      ? Math.max(payload.count, normalizedItems.length)
      : normalizedItems.length

  return {
    items: normalizedItems,
    offset: resolvedOffset,
    limit: resolvedLimit,
    count: resolvedCount,
  }
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

export const eqpApi = {
  /**
   * 설비 목록을 조회합니다.
   */
  getEqpList: async (offset = 0, limit = 500): Promise<EqpInfoPage> => {
    try {
      const response = await apiClient.get<EqpInfoListResponse>('/eqp', {
        params: { offset, limit },
        withCredentials: true,
      })

      const successPayload = resolveSuccessPayload<unknown>(
        response.data,
        response.status,
        EQP_LIST_FALLBACK_MESSAGE,
      )

      return normalizeEqpListPayload(successPayload, offset, limit)
    } catch (error) {
      throw normalizeEqpError(error, EQP_LIST_FALLBACK_MESSAGE)
    }
  },

  /**
   * 설비 단건 상세를 조회합니다.
   */
  getEqpDetail: async (eqpId: string): Promise<EqpInfo> => {
    try {
      const response = await apiClient.get<EqpInfoDetailResponse>(`/eqp/${encodeURIComponent(eqpId)}`, {
        withCredentials: true,
      })

      return resolveSuccessPayload<EqpInfo>(
        response.data,
        response.status,
        '설비 상세 정보를 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeEqpError(error, '설비 상세 정보를 조회하지 못했습니다.')
    }
  },

  /**
   * EQP 관리 상세를 조회합니다.
   */
  getEqpManageDetail: async (eqpId: string): Promise<EqpManageDetail> => {
    try {
      const response = await apiClient.get<EqpManageDetailResponse>(
        `/eqp/${encodeURIComponent(eqpId)}/manage`,
        {
          withCredentials: true,
        },
      )

      return resolveSuccessPayload<EqpManageDetail>(
        response.data,
        response.status,
        '설비 관리 상세 정보를 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeEqpError(error, '설비 관리 상세 정보를 조회하지 못했습니다.')
    }
  },

  /**
   * EQP 관리 화면 옵션을 조회합니다.
   */
  getEqpManageOptions: async (): Promise<EqpManageOptions> => {
    try {
      const response = await apiClient.get<EqpManageOptionsResponse>('/eqp/options', {
        withCredentials: true,
      })

      return resolveSuccessPayload<EqpManageOptions>(
        response.data,
        response.status,
        '설비 관리 옵션을 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeEqpError(error, '설비 관리 옵션을 조회하지 못했습니다.')
    }
  },

  /**
   * 설비별 파라미터 버전 목록을 조회합니다.
   */
  getEqpParamVersions: async (eqpId: string): Promise<string[]> => {
    try {
      const response = await apiClient.get<EqpParamVersionListResponse>(
        `/eqp/${encodeURIComponent(eqpId)}/param-versions`,
        {
          withCredentials: true,
        },
      )

      const versions = resolveSuccessPayload<string[]>(
        response.data,
        response.status,
        '설비 파라미터 버전 목록을 조회하지 못했습니다.',
      )

      return versions.filter((version) => typeof version === 'string' && version.trim().length > 0)
    } catch (error) {
      throw normalizeEqpError(error, '설비 파라미터 버전 목록을 조회하지 못했습니다.')
    }
  },

  /**
   * modelVersionKey로 모델 정보를 조회합니다.
   */
  getEqpModelInfoByVersionKey: async (modelVersionKey: number): Promise<EqpModelInfo> => {
    try {
      const response = await apiClient.get<EqpModelInfoResponse>(`/model/${modelVersionKey}`, {
        withCredentials: true,
      })

      return resolveSuccessPayload<EqpModelInfo>(
        response.data,
        response.status,
        '연결 모델 정보를 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeEqpError(error, '연결 모델 정보를 조회하지 못했습니다.')
    }
  },

  /**
   * 선택 설비의 런타임 상태를 조회합니다.
   */
  getEqpRuntimeState: async (eqpId: string): Promise<EqpRuntimeState> => {
    try {
      const response = await apiClient.get<EqpRuntimeStateResponse>(
        `/eqp/${encodeURIComponent(eqpId)}/runtime-state`,
        {
          withCredentials: true,
        },
      )

      return resolveSuccessPayload<EqpRuntimeState>(
        response.data,
        response.status,
        '설비 런타임 상태를 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeEqpError(error, '설비 런타임 상태를 조회하지 못했습니다.')
    }
  },

  /**
   * 설비 체크아웃 상태를 조회합니다.
   */
  getEqpCheckoutStatus: async (eqpId: string): Promise<EqpCheckoutStatus> => {
    try {
      const response = await apiClient.get<EqpCheckoutStatusResponse>(
        `/eqp/${encodeURIComponent(eqpId)}/checkout-status`,
        { withCredentials: true },
      )

      const payload = resolveSuccessPayload<{ checkedOut: boolean; checkedOutBy: string | null }>(
        response.data,
        response.status,
        '설비 체크아웃 상태를 조회하지 못했습니다.',
      )

      return {
        isCheckedOut: payload.checkedOut,
        checkedOutBy: payload.checkedOutBy,
      }
    } catch (error) {
      throw normalizeEqpError(error, '설비 체크아웃 상태를 조회하지 못했습니다.')
    }
  },

  /**
   * 특정 버전의 설비 파라미터 목록을 조회합니다.
   */
  getEqpParams: async (eqpId: string, version: string): Promise<EqpParam[]> => {
    try {
      const response = await apiClient.get<EqpParamListResponse>(
        `/eqp/${encodeURIComponent(eqpId)}/params`,
        {
          params: { version },
          withCredentials: true,
        },
      )

      return resolveSuccessPayload<EqpParam[]>(
        response.data,
        response.status,
        '설비 파라미터 목록을 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeEqpError(error, '설비 파라미터 목록을 조회하지 못했습니다.')
    }
  },

  /**
   * 설비 파라미터를 체크아웃합니다.
   * 이미 체크아웃 중이면 EqpApiError(status=409)를 던집니다.
   */
  checkoutEqp: async (eqpId: string, request: EqpCheckoutRequest): Promise<EqpParam[]> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<EqpParamListResponse>(
          `/eqp/${encodeURIComponent(eqpId)}/checkout`,
          request,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      return resolveSuccessPayload<EqpParam[]>(
        response.data,
        response.status,
        '설비 체크아웃에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeEqpError(error, '설비 체크아웃에 실패했습니다.')
    }
  },

  /**
   * EDIT 버전의 설비 파라미터를 저장합니다.
   */
  saveEqpEditParams: async (eqpId: string, params: EqpParamSaveItem[]): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<EqpDualCommandResponse>(
          `/eqp/${encodeURIComponent(eqpId)}/edit-params`,
          { params },
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      resolveSuccessPayload<null>(response.data, response.status, 'EDIT 파라미터 저장에 실패했습니다.', true)
    } catch (error) {
      throw normalizeEqpError(error, 'EDIT 파라미터 저장에 실패했습니다.')
    }
  },

  /**
   * 설비 파라미터 체크아웃을 되돌리고 EDIT 버전을 삭제합니다.
   */
  undoEqpCheckout: async (eqpId: string): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<EqpDualCommandResponse>(
          `/eqp/${encodeURIComponent(eqpId)}/checkout`,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      resolveSuccessPayload<null>(
        response.data,
        response.status,
        '체크아웃 되돌리기에 실패했습니다.',
        true,
      )
    } catch (error) {
      throw normalizeEqpError(error, '체크아웃 되돌리기에 실패했습니다.')
    }
  },

  /**
   * 설비 파라미터를 체크인합니다.
   */
  checkinEqp: async (eqpId: string, request: EqpCheckinRequest): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<EqpDualCommandResponse>(
          `/eqp/${encodeURIComponent(eqpId)}/checkin`,
          request,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      resolveSuccessPayload<null>(response.data, response.status, '설비 체크인에 실패했습니다.', true)
    } catch (error) {
      throw normalizeEqpError(error, '설비 체크인에 실패했습니다.')
    }
  },

  /**
   * 설비를 등록합니다.
   */
  createEqp: async (request: EqpCreateRequest): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<EqpDualCommandResponse>('/eqp', request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      resolveSuccessPayload<null>(response.data, response.status, '설비 등록에 실패했습니다.', true)
    } catch (error) {
      throw normalizeEqpError(error, '설비 등록에 실패했습니다.')
    }
  },

  /**
   * 설비를 수정합니다.
   */
  updateEqp: async (eqpId: string, request: EqpUpdateRequest): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<EqpDualCommandResponse>(`/eqp/${encodeURIComponent(eqpId)}`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      resolveSuccessPayload<null>(response.data, response.status, '설비 수정에 실패했습니다.', true)
    } catch (error) {
      throw normalizeEqpError(error, '설비 수정에 실패했습니다.')
    }
  },

  /**
   * 설비를 삭제합니다.
   */
  deleteEqp: async (eqpId: string): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<EqpDualCommandResponse>(`/eqp/${encodeURIComponent(eqpId)}`, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      resolveSuccessPayload<null>(response.data, response.status, '설비 삭제에 실패했습니다.', true)
    } catch (error) {
      throw normalizeEqpError(error, '설비 삭제에 실패했습니다.')
    }
  },

  /**
   * 설비 start를 요청하고 polling traceId를 반환합니다.
   */
  startEqp: async (eqpId: string, request: EqpLifecycleRequest): Promise<string> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<AsyncAcceptResponse>(`/eqp/${encodeURIComponent(eqpId)}/start`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      const payload = resolveSuccessPayload<{ traceId: string }>(
        response.data,
        response.status,
        '설비 시작 요청에 실패했습니다.',
      )

      if (!payload.traceId) {
        throw new EqpApiError(
          createEqpFailResponse({
            success: false,
            data: null,
            errorCode: 'INVALID_RESPONSE',
            errorMsg: '설비 시작 응답에 traceId가 없습니다.',
          }),
          response.status,
        )
      }

      return payload.traceId
    } catch (error) {
      throw normalizeEqpError(error, '설비 시작 요청에 실패했습니다.')
    }
  },

  /**
   * 설비 end를 요청하고 polling traceId를 반환합니다.
   */
  endEqp: async (eqpId: string, request: EqpLifecycleRequest): Promise<string> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<AsyncAcceptResponse>(`/eqp/${encodeURIComponent(eqpId)}/end`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      const payload = resolveSuccessPayload<{ traceId: string }>(
        response.data,
        response.status,
        '설비 종료 요청에 실패했습니다.',
      )

      if (!payload.traceId) {
        throw new EqpApiError(
          createEqpFailResponse({
            success: false,
            data: null,
            errorCode: 'INVALID_RESPONSE',
            errorMsg: '설비 종료 응답에 traceId가 없습니다.',
          }),
          response.status,
        )
      }

      return payload.traceId
    } catch (error) {
      throw normalizeEqpError(error, '설비 종료 요청에 실패했습니다.')
    }
  },

  /**
   * 비동기 작업 결과를 조회합니다.
   * 202(PENDING), 200(PASS/FAIL), 408(TIMEOUT)을 모두 payload로 반환합니다.
   */
  getAsyncResult: async (traceId: string): Promise<AsyncResultData> => {
    try {
      const response = await apiClient.get<AsyncResultResponse>(`/async/${encodeURIComponent(traceId)}`, {
        withCredentials: true,
        validateStatus: (status) => status >= 200 && status < 500,
      })

      if (response.status === 404) {
        throw new EqpApiError(
          createEqpFailResponse({
            success: false,
            data: null,
            errorCode: 'NOT_FOUND',
            errorMsg: '요청한 비동기 작업을 찾을 수 없습니다.',
          }),
          404,
        )
      }

      return resolveSuccessPayload<AsyncResultData>(
        response.data,
        response.status,
        '비동기 작업 결과를 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeEqpError(error, '비동기 작업 결과를 조회하지 못했습니다.')
    }
  },
}
