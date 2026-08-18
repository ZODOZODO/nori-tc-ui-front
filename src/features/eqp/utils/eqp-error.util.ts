import { ApiError } from '@/shared/lib/api-error'

/**
 * 재시도해도 같은 결과가 돌아오는 실패인지 판별합니다.
 *
 * 4xx 는 요청 자체가 잘못됐다는 뜻이라 같은 요청을 다시 보내도 답이 같습니다.
 * 그런데도 재시도를 걸면 서버 부하만 배로 늘고 사용자에게는 오류 표시만 늦어집니다.
 * 실제로 그룹 화면이 한도 초과(400)를 3회 더 재시도해 한 번의 조작이 4번의 요청이 됐습니다
 * (2026-08-10 실측 22회).
 *
 * status 를 모르는 실패(네트워크 단절 등)는 재시도 대상이므로 false 를 돌려줍니다.
 */
export const isClientRequestError = (error: unknown): boolean =>
  error instanceof ApiError &&
  error.status !== undefined &&
  error.status >= 400 &&
  error.status < 500
