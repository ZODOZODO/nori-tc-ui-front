/**
 * 알 수 없는 오류를 화면 메시지로 변환합니다.
 *
 * {@link import('./api-error').ApiError} 를 따로 분기하지 않는다 — `Error` 를 상속하면서
 * `super(payload.errorMsg)` 로 서버 문구를 그대로 `message` 에 담기 때문에(`api-error.ts`)
 * 결과가 같다. 대신 로컬 검증이 던지는 `new Error(i18n.t(...))` 도 같은 경로로 표면화된다 —
 * "어느 필드가 정수여야 하는지" 가 일반 fallback 문구에 묻히면 사용자가 조치할 수 없다.
 *
 * feature 별 사본을 두면 경계 위반이나 사본 증식으로 이어지므로 자리가 shared 다.
 */
export const resolveErrorMessage = (error: unknown, fallbackMessage: string): string =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallbackMessage
