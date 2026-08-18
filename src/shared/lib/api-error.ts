import { isAxiosError } from 'axios'
import { isApiResponse, type ApiResponse } from '@/shared/types/api.types'

/**
 * 백엔드 실패 응답의 정규화된 형태입니다. errorCode/errorMsg 가 항상 채워집니다.
 */
export type ApiFailResponse = ApiResponse<null> & {
  success: false
  data: null
  errorCode: string
  errorMsg: string
}

/**
 * 어떤 입력이 와도 실패 응답 형태로 정규화합니다.
 * - 백엔드 실패 payload 를 우선 사용
 * - 형식이 맞지 않으면 UNKNOWN_ERROR + fallbackMessage 로 보정
 */
export const createFailResponse = (payload: unknown, fallbackMessage: string): ApiFailResponse => {
  if (isApiResponse(payload) && payload.success === false) {
    return {
      success: false,
      data: null,
      errorCode:
        typeof payload.errorCode === 'string' && payload.errorCode.length > 0
          ? payload.errorCode
          : 'UNKNOWN_ERROR',
      errorMsg:
        typeof payload.errorMsg === 'string' && payload.errorMsg.length > 0
          ? payload.errorMsg
          : fallbackMessage,
    }
  }

  return {
    success: false,
    data: null,
    errorCode: 'UNKNOWN_ERROR',
    errorMsg: fallbackMessage,
  }
}

/**
 * API 계층 공용 에러 타입입니다. status 는 HTTP 상태코드가 있을 때만 채워집니다.
 *
 * 도메인별 하위 클래스를 두지 않습니다 — 6개 도메인 에러의 구조가 동일했고,
 * `instanceof` 로 도메인을 판별하던 곳이 없어 단일 클래스로 충분합니다.
 */
export class ApiError extends Error {
  public readonly payload: ApiFailResponse
  public readonly status?: number

  constructor(payload: ApiFailResponse, status?: number) {
    super(payload.errorMsg)
    this.name = 'ApiError'
    this.payload = payload
    this.status = status
  }
}

/**
 * 어떤 예외가 와도 ApiError 로 정규화합니다.
 *
 * axios 에러도 Error 인스턴스라 `instanceof Error` 를 먼저 검사하면 백엔드 errorMsg 를 버리고
 * "Request failed with status code 409" 원문을 노출한다 — isAxiosError 를 먼저 본다.
 */
export const normalizeApiError = (error: unknown, fallbackMessage: string): ApiError => {
  if (error instanceof ApiError) {
    return error
  }

  if (isAxiosError(error)) {
    return new ApiError(
      createFailResponse(error.response?.data, fallbackMessage),
      error.response?.status,
    )
  }

  return new ApiError(createFailResponse(error, fallbackMessage))
}

/**
 * data 없이 성공 여부만 검증합니다. DELETE 처럼 `data: null` 이 정상인 응답에서 씁니다.
 */
export const assertSuccessResponse = (
  payload: unknown,
  status: number,
  fallbackMessage: string,
): void => {
  if (!isApiResponse(payload) || payload.success !== true) {
    throw new ApiError(createFailResponse(payload, fallbackMessage), status)
  }
}

/**
 * 성공 응답의 data 를 꺼냅니다. 성공 형태가 아니면 ApiError 로 던집니다.
 */
export const resolveSuccessPayload = <TData>(
  payload: unknown,
  status: number,
  fallbackMessage: string,
): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true || payload.data === null) {
    throw new ApiError(createFailResponse(payload, fallbackMessage), status)
  }

  return payload.data
}
