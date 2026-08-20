import { toast } from '@/shared/stores/toast.store'
import { resolveErrorMessage } from './resolve-error-message'

/**
 * 변경 요청 실패를 토스트로 알리고 띄운 문구를 반환합니다.
 *
 * <p>사유는 이미 손에 있다 — api 레이어(`normalizeError`)와 각 feature 의 `*ApiError` 는 서버가 실은
 * `errorMsg` 를 그대로 `Error.message` 에 담는다. 화면이 그걸 띄우지 않아 "됐는지 안 됐는지" 를
 * 사용자가 결과 목록으로 추측하던 게 결함이었다.</p>
 *
 * <p>반환값은 폼·다이얼로그 인라인 표시를 함께 쓰는 호출자가 같은 문구를 재계산하지 않게 하기
 * 위한 것이다 — `setFormError(notifyFailure(error, t('...')))` 로 한 줄에 둘 다 처리한다.</p>
 */
export function notifyFailure(error: unknown, fallbackMessage: string): string {
  const message = resolveErrorMessage(error, fallbackMessage)
  toast.error(message)
  return message
}
