const CSRF_COOKIE_NAME = 'XSRF-TOKEN'

/**
 * 브라우저에서 접근 가능한 CSRF 쿠키를 삭제합니다.
 */
export const clearCsrfCookie = () => {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${CSRF_COOKIE_NAME}=; Max-Age=0; path=/`
}
