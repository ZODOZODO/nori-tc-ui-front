import { apiClient } from './api-client'

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
 * 실패는 던져 올린다 — 도메인별 에러 타입·메시지로 감싸는 책임은 호출자에게 있다
 * (`auth.api.ts` 만 이 요청 실패를 purpose 별로 정규화한다).
 */
export const requestCsrfCookie = async (): Promise<void> => {
  await apiClient.get('/auth/csrf', { withCredentials: true })
}

/** 발급된 CSRF 토큰을 읽는다. 없으면 null — 도메인별 CSRF_TOKEN_MISSING 에러는 호출자가 던진다. */
export const readCsrfCookieToken = (): string | null => readCookie(CSRF_COOKIE_NAME)
