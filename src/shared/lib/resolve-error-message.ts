import { ApiError } from './api-error'

/**
 * 알 수 없는 오류를 화면 메시지로 변환합니다.
 *
 * {@link ApiError} 를 푸는 일이라 자리가 shared 다 — feature 별 사본을 두면 model 이
 * features/eqp/lib 을 import 하는 경계 위반이나 사본 증식으로 이어진다.
 */
export const resolveErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof ApiError) {
    return error.payload.errorMsg
  }

  return fallbackMessage
}
