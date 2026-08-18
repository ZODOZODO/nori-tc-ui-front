import i18n from '@/i18n'
import { apiClient } from './api-client'
import { ApiError, createFailResponse } from './api-error'

/** 서버가 발급하는 double-submit CSRF 쿠키 이름(JS 가시). */
export const CSRF_COOKIE_NAME = 'XSRF-TOKEN'

/** 상태 변경 요청에 되돌려 보내는 CSRF 헤더 이름. */
export const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'

const readCookie = (name: string): string | null => {
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
 * 서버에 CSRF 쿠키 발급을 요청한다.
 *
 * 실패는 던져 올린다 — 요청 실패를 purpose 별로 정규화하는 책임은 호출자에게 있다
 * (`auth.api.ts` 만 login/logout 문맥으로 감싼다).
 */
export const requestCsrfCookie = async (): Promise<void> => {
  await apiClient.get('/auth/csrf', { withCredentials: true })
}

/** 발급된 CSRF 토큰을 읽는다. 없으면 null. */
export const readCsrfCookieToken = (): string | null => readCookie(CSRF_COOKIE_NAME)

/**
 * 쓰기 요청에 붙일 CSRF 토큰을 발급받는다 — 요청 → 쿠키 읽기 → 미존재 시 CSRF_TOKEN_MISSING.
 *
 * 백엔드(Spring Security)는 Double Submit Cookie 방식이라 GET /auth/csrf 선호출로 쿠키를 받은 뒤
 * 그 값을 X-XSRF-TOKEN 헤더로 되돌려 보내야 한다.
 */
export const issueCsrfToken = async (): Promise<string> => {
  await requestCsrfCookie()

  const csrfToken = readCsrfCookieToken()
  if (!csrfToken) {
    throw new ApiError(
      createFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'CSRF_TOKEN_MISSING',
          errorMsg: i18n.t('error.auth.csrf'),
        },
        i18n.t('error.auth.csrf'),
      ),
    )
  }

  return csrfToken
}
