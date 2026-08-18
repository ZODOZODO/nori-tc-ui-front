import i18n from '@/i18n'
import { isApiResponse, isRecord, type ApiResponse } from '@/shared/types/api.types'

/**
 * POST /api/auth/login 요청 바디 타입입니다.
 */
export interface LoginRequest {
  userId: string
  password: string
}

/**
 * 로그인 성공 시 data payload 타입입니다.
 * 토큰은 HttpOnly 쿠키로만 전달되므로 이 타입에 token 필드는 없습니다.
 */
export interface LoginSuccessData {
  userPk: number
  issuedAt: string
  expiresAt: string
}

/**
 * 로그인 성공 응답 타입입니다.
 */
export type LoginSuccessResponse = ApiResponse<LoginSuccessData> & {
  success: true
  data: LoginSuccessData
  errorCode: null
  errorMsg: null
}

/**
 * 로그인 실패 응답 타입입니다.
 */
export type LoginFailResponse = ApiResponse<null> & {
  success: false
  data: null
  errorCode: string
  errorMsg: string
}

/**
 * 로그인 API 응답 유니온 타입입니다.
 */
export type LoginResponse = LoginSuccessResponse | LoginFailResponse

/**
 * 서버에서 예측하지 못한 응답이 오거나 네트워크 오류가 발생했을 때
 * 사용자에게 보여줄 기본 메시지입니다.
 * 모듈 로드 시점이 아닌 호출 시점에 평가해 현재 UI 언어를 따르도록 getter 로 둔다.
 */
export const defaultAuthErrorMessage = () => i18n.t('error.auth.login')

/**
 * 로그인 성공 응답인지 확인합니다.
 */
export const isLoginSuccessResponse = (value: unknown): value is LoginSuccessResponse => {
  if (!isApiResponse<LoginSuccessData>(value) || value.success !== true) {
    return false
  }

  if (!isRecord(value.data)) {
    return false
  }

  return (
    typeof value.data.userPk === 'number' &&
    typeof value.data.issuedAt === 'string' &&
    typeof value.data.expiresAt === 'string' &&
    value.errorCode === null &&
    value.errorMsg === null
  )
}

/**
 * 로그인 실패 응답인지 확인합니다.
 */
export const isLoginFailResponse = (value: unknown): value is LoginFailResponse => {
  if (!isApiResponse(value) || value.success !== false) {
    return false
  }

  return (
    value.data === null && typeof value.errorCode === 'string' && typeof value.errorMsg === 'string'
  )
}

/**
 * 어떤 입력이 와도 로그인 실패 응답 형태로 정규화합니다.
 * - 백엔드 실패 payload를 우선 사용
 * - 형식이 맞지 않으면 기본 코드/메시지로 보정
 */
export const createLoginFailResponse = (
  payload: unknown,
  fallbackMessage = defaultAuthErrorMessage()
): LoginFailResponse => {
  if (isLoginFailResponse(payload)) {
    return payload
  }

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

