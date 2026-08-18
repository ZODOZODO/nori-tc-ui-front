import { isAxiosError } from 'axios'
import i18n from '@/i18n'
import { apiClient } from '@/shared/lib/api-client'
import { CSRF_HEADER_NAME, issueCsrfToken } from '@/shared/lib/csrf'
import {
  defaultAuthErrorMessage,
  createLoginFailResponse,
  isLoginSuccessResponse,
  type LoginFailResponse,
  type LoginRequest,
  type LoginResponse,
  type LoginSuccessResponse,
} from '../types/auth.types'
import { ApiError } from '@/shared/lib/api-error'

// 모듈 로드 시점이 아닌 호출 시점에 평가해 현재 UI 언어를 따르도록 getter 로 둔다.
const defaultLogoutErrorMessage = () => i18n.t('error.auth.logout')
const loginCsrfForbiddenMessage = () => i18n.t('error.auth.loginCsrfBlocked')
const loginForbiddenMessage = () => i18n.t('error.auth.loginCsrfFailed')
const logoutCsrfForbiddenMessage = () => i18n.t('error.auth.logoutCsrfBlocked')
const logoutForbiddenMessage = () => i18n.t('error.auth.logoutCsrfFailed')

type AuthErrorContext = 'login-csrf' | 'login-submit' | 'logout-csrf' | 'logout-submit'
type CsrfRequestPurpose = 'login' | 'logout'

/**
 * 403 Forbidden 응답을 요청 문맥별 사용자 안내 메시지로 변환합니다.
 */
const buildForbiddenAuthResponse = (context: AuthErrorContext): LoginFailResponse => {
  switch (context) {
    case 'login-csrf':
      return {
        success: false,
        data: null,
        errorCode: 'LOGIN_CSRF_FORBIDDEN',
        errorMsg: loginCsrfForbiddenMessage(),
      }
    case 'login-submit':
      return {
        success: false,
        data: null,
        errorCode: 'LOGIN_FORBIDDEN',
        errorMsg: loginForbiddenMessage(),
      }
    case 'logout-csrf':
      return {
        success: false,
        data: null,
        errorCode: 'LOGOUT_CSRF_FORBIDDEN',
        errorMsg: logoutCsrfForbiddenMessage(),
      }
    case 'logout-submit':
      return {
        success: false,
        data: null,
        errorCode: 'LOGOUT_FORBIDDEN',
        errorMsg: logoutForbiddenMessage(),
      }
  }
}

/**
 * 인증 API에서 403이 발생했을 때 요청 문맥에 맞는 안내 메시지로 보정합니다.
 * 로그인/로그아웃 공개 엔드포인트의 403은 대부분 CSRF 또는 CORS 보안 정책 불일치이므로
 * 스프링 기본 Forbidden payload 대신 사용자가 바로 조치할 수 있는 문구를 우선 노출합니다.
 */
const createContextualAuthFailResponse = (
  payload: unknown,
  status: number | undefined,
  fallbackMessage: string,
  context: AuthErrorContext
): LoginFailResponse => {
  if (status === 403) {
    return buildForbiddenAuthResponse(context)
  }

  return createLoginFailResponse(payload, fallbackMessage)
}

/**
 * 공용 CSRF 토큰 발급을 auth 문맥(login / logout)으로 감쌉니다.
 * 공용 정의가 던지는 CSRF_TOKEN_MISSING(ApiError)은 그대로 통과하고,
 * 쿠키 요청 자체가 403 으로 막힌 경우만 문맥별 안내 문구로 보정됩니다.
 */
const requestAuthCsrfToken = async (purpose: CsrfRequestPurpose): Promise<string> => {
  try {
    return await issueCsrfToken()
  } catch (error) {
    const fallbackMessage =
      purpose === 'login' ? defaultAuthErrorMessage() : defaultLogoutErrorMessage()
    const errorContext: AuthErrorContext = purpose === 'login' ? 'login-csrf' : 'logout-csrf'
    throw normalizeAuthError(error, fallbackMessage, errorContext)
  }
}

/**
 * 알 수 없는 예외를 ApiError로 정규화합니다.
 */
const normalizeAuthError = (
  error: unknown,
  fallbackMessage = defaultAuthErrorMessage(),
  context: AuthErrorContext = 'login-submit'
): ApiError => {
  if (error instanceof ApiError) {
    return error
  }

  if (isAxiosError(error)) {
    return new ApiError(
      createContextualAuthFailResponse(error.response?.data, error.response?.status, fallbackMessage, context),
      error.response?.status
    )
  }

  return new ApiError(createContextualAuthFailResponse(error, undefined, fallbackMessage, context))
}

export const authApi = {
  /**
   * 로그인 요청에서 사용할 CSRF 토큰을 미리 확보합니다.
   * 이후 다른 상태 변경 API(POST/PUT/PATCH/DELETE)에서도 같은 규칙으로 재사용할 수 있습니다.
   */
  prepareCsrfToken: () => requestAuthCsrfToken('login'),

  /**
   * 로그인 API를 호출합니다.
   * - GET /api/auth/csrf 선호출
   * - POST /api/auth/login 호출 시 withCredentials + X-XSRF-TOKEN 헤더 포함
   * - token 본문 의존 없이 쿠키 기반 인증만 사용
  */
  login: async (credentials: LoginRequest): Promise<LoginSuccessResponse> => {
    const csrfToken = await requestAuthCsrfToken('login')

    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials, {
        withCredentials: true,
        headers: {
          [CSRF_HEADER_NAME]: csrfToken,
        },
        // 로그인 실패(400/401)는 폼 하단에 서버 메시지를 노출해야 하므로
        // axios 전역 401 인터셉터 리다이렉트를 우회하기 위해 정상 응답으로 처리합니다.
        validateStatus: (status) => status >= 200 && status < 500,
      })

      const parsedResponse = response.data

      if (isLoginSuccessResponse(parsedResponse)) {
        console.info('[authApi] login success', {
          userPk: parsedResponse.data.userPk,
        })
        return parsedResponse
      }

      throw new ApiError(
        createContextualAuthFailResponse(
          parsedResponse,
          response.status,
          defaultAuthErrorMessage(),
          'login-submit'
        ),
        response.status
      )
    } catch (error) {
      const normalizedError = normalizeAuthError(error, defaultAuthErrorMessage(), 'login-submit')
      console.warn('[authApi] login failed', {
        status: normalizedError.status,
        errorCode: normalizedError.payload.errorCode,
      })
      throw normalizedError
    }
  },

  /**
   * 로그아웃 API를 호출하여 서버 세션/쿠키를 무효화합니다.
   * - POST /api/auth/logout 호출 전 CSRF 토큰을 발급받아 헤더에 포함합니다.
   * - 401은 이미 인증이 만료된 상태일 수 있으므로 로그아웃 완료로 간주합니다.
  */
  logout: async (): Promise<void> => {
    const csrfToken = await requestAuthCsrfToken('logout')

    try {
      const response = await apiClient.post('/auth/logout', null, {
        withCredentials: true,
        headers: {
          [CSRF_HEADER_NAME]: csrfToken,
        },
        validateStatus: (status) => status >= 200 && status < 500,
      })

      if (response.status === 401) {
        console.info('[authApi] logout skipped due to already invalid session')
        return
      }

      if (response.status >= 400) {
        throw new ApiError(
          createContextualAuthFailResponse(
            response.data,
            response.status,
            defaultLogoutErrorMessage(),
            'logout-submit'
          ),
          response.status
        )
      }

      console.info('[authApi] logout success')
    } catch (error) {
      const normalizedError = normalizeAuthError(
        error,
        defaultLogoutErrorMessage(),
        'logout-submit'
      )
      console.warn('[authApi] logout failed', {
        status: normalizedError.status,
        errorCode: normalizedError.payload.errorCode,
      })
      throw normalizedError
    }
  },
}
