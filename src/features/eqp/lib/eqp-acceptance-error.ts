import { ApiError } from '@/shared/lib/api-error'
import { resolveErrorMessage } from '@/shared/lib/resolve-error-message'

/** 같은 Idempotency-Key 에 다른 목표 상태 manifest 가 도착했을 때의 백엔드 errorCode. */
export const IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT'

/** 사용자 안내 문구의 i18n 키. */
export const IDEMPOTENCY_CONFLICT_HINT_KEY = 'eqp.operation.idempotencyConflictHint'

/**
 * 설비 mutation **접수 거부**를 화면 메시지로 바꿉니다.
 *
 * `IDEMPOTENCY_CONFLICT` 만 서버 문구를 쓰지 않습니다. 서버 문구는 "같은 키에 다른 요청 내용"
 * 인데, 사용자가 **같은 폼을 그대로 다시 낸 경우에도** 발생합니다 — 대상 리소스의 revision 이
 * 전진하면 목표 상태 manifest 의 `expectedBaseRevisions` 가 달라져 digest 가 바뀌기 때문입니다
 * (§8.4). 즉 앞선 요청이 **이미 성공했을 때도** 같은 409 가 나옵니다. 서버 문구만 노출하면
 * 사용자는 이를 실패로 읽고 재시도합니다.
 *
 * 두 원인은 프론트에서 구분할 수 없습니다 — 원 operationId 가 응답 본문 필드가 아니라 errorMsg
 * 문자열 안에만 있습니다. 그래서 둘 다 포괄하는 안내로 두고, 재시도 전에 현재 상태를 확인하도록
 * 유도합니다.
 *
 * 나머지 거부(RESOURCE_BUSY / REVISION_CONFLICT / COORDINATION_UNAVAILABLE)는 서버 문구가
 * 그대로 정확하므로 건드리지 않습니다.
 *
 * @param error 접수 호출이 던진 예외
 * @param fallbackMessage 서버 문구가 없을 때 쓸 기본 문구
 * @param translate i18n 조회 함수
 * @returns 화면에 표시할 메시지
 */
export const resolveAcceptanceErrorMessage = (
  error: unknown,
  fallbackMessage: string,
  translate: (key: string) => string,
): string => {
  if (error instanceof ApiError && error.payload.errorCode === IDEMPOTENCY_CONFLICT) {
    return translate(IDEMPOTENCY_CONFLICT_HINT_KEY)
  }

  return resolveErrorMessage(error, fallbackMessage)
}
