import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, createFailResponse } from '@/shared/lib/api-error.ts'
import { resolveErrorMessage } from '@/shared/lib/resolve-error-message.ts'
import { notifyFailure } from '@/shared/lib/notify.ts'
import { useToastStore } from '@/shared/stores/toast.store.ts'

/**
 * `resolveErrorMessage` 는 30 곳 이상이 부르는 공용 계약인데 테스트가 없었다.
 *
 * ApiError 전용 의미에서 Error-우선 의미로 넓히면서(#10-B) 두 가지가 동시에 걸려 있다 —
 * 서버 문구를 잃지 않아야 하고, 로컬 검증이 던지는 `new Error(i18n.t(...))` 도 그대로 보여야 한다.
 * 어느 쪽이든 조용히 fallback 으로 뭉개지면 사용자는 "왜 안 되는지" 를 알 수 없다.
 */

const FALLBACK = '기본 실패 문구'

const createServerFailure = (errorMsg: string): ApiError =>
  new ApiError(createFailResponse({ success: false, data: null, errorCode: 'DENIED', errorMsg }, FALLBACK), 403)

test('ApiError 는 서버 errorMsg 를 그대로 노출한다', () => {
  assert.equal(resolveErrorMessage(createServerFailure('이미 체크아웃 상태입니다'), FALLBACK), '이미 체크아웃 상태입니다')
})

test('로컬 검증이 던진 Error 의 message 를 fallback 으로 뭉개지 않는다', () => {
  assert.equal(resolveErrorMessage(new Error('Unit ID 는 정수여야 합니다'), FALLBACK), 'Unit ID 는 정수여야 합니다')
})

test('message 가 빈 Error 는 fallback 으로 대체한다', () => {
  assert.equal(resolveErrorMessage(new Error('   '), FALLBACK), FALLBACK)
})

test('Error 가 아닌 값은 fallback 으로 대체한다', () => {
  assert.equal(resolveErrorMessage({ errorMsg: '무시된다' }, FALLBACK), FALLBACK)
  assert.equal(resolveErrorMessage(undefined, FALLBACK), FALLBACK)
})

test('notifyFailure 는 같은 문구를 토스트로 띄우고 그대로 반환한다', () => {
  useToastStore.setState({ toasts: [] })

  const returned = notifyFailure(createServerFailure('권한이 없습니다'), FALLBACK)

  assert.equal(returned, '권한이 없습니다')
  const { toasts } = useToastStore.getState()
  assert.equal(toasts.length, 1)
  assert.equal(toasts[0].variant, 'error')
  assert.equal(toasts[0].message, '권한이 없습니다')
})
