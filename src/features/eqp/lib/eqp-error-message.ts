import { ApiError } from '@/shared/lib/api-error'

/**
 * 알 수 없는 오류를 화면 메시지로 변환합니다.
 *
 * EqpPage 와 {@link useEqpLifecycleCommands} 가 함께 쓴다 — 훅이 페이지를 import 하면
 * 순환 참조가 되므로 공유 지점을 lib 에 둔다.
 */
export const resolveErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof ApiError) {
    return error.payload.errorMsg
  }

  return fallbackMessage
}
