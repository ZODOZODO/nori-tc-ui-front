import axios from 'axios'

/** 백엔드가 operation 접수의 idempotency 판정에 쓰는 헤더 이름(§13.2 / §14.1). */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key'

/** idempotency key 를 실어야 하는 상태 변경 메서드. */
const MUTATING_METHODS: readonly string[] = ['post', 'put', 'patch', 'delete']

/**
 * Spring Boot 백엔드와 통신하는 axios 인스턴스
 * - /api 로 시작하는 요청은 vite proxy 를 통해 localhost:8080 으로 전달
 * - 쿠키 기반 인증(HttpOnly Cookie) 사용을 위해 withCredentials 기본 활성화
 */
export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
})

// 요청 인터셉터 — 상태 변경 요청마다 Idempotency-Key 를 발급한다(§14.1).
// NOTE: 호출부마다 붙이지 않고 여기 한 곳에 두는 이유는, 쓰기 호출이 withCsrfHeaders /
//       issueCsrfToken 두 idiom 으로 9 개 파일 58 곳에 흩어져 있어 per-call 방식이 산탄 변경을
//       만들기 때문이다. 호출부가 같은 논리적 작업을 재시도하려고 키를 직접 실었다면 덮어쓰지
//       않는다 — 덮어쓰면 재시도가 새 operation 으로 접수돼 중복 변경이 된다.
apiClient.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase()
  if (method === undefined || !MUTATING_METHODS.includes(method)) {
    return config
  }

  if (!config.headers.get(IDEMPOTENCY_KEY_HEADER)) {
    config.headers.set(IDEMPOTENCY_KEY_HEADER, crypto.randomUUID())
  }

  return config
})

// 응답 인터셉터 — 401 시 로그인 페이지로 이동
// NOTE: 이미 /login 에 있을 때 다시 리다이렉트하면 전체 페이지가 무한 reload됩니다.
//       만료 쿠키가 남아 있는 상태에서 CSRF 요청이 실패하는 경우가 대표적인 사례입니다.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
