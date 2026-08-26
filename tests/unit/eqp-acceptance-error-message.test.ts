import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, type ApiFailResponse } from '@/shared/lib/api-error.ts'
import {
  IDEMPOTENCY_CONFLICT_HINT_KEY,
  resolveAcceptanceErrorMessage,
} from '@/features/eqp/lib/eqp-acceptance-error.ts'

/**
 * 설비 mutation **접수 거부** 문구 계약.
 *
 * `IDEMPOTENCY_CONFLICT` 는 사용자가 같은 폼을 그대로 다시 냈을 때도 발생한다 — 대상 리소스의
 * revision 이 전진하면 목표 상태 manifest 가 달라져 digest 가 바뀌기 때문이다(§8.4). 그러니
 * "앞선 요청이 이미 반영됐을 수 있음" 을 알려야 하는데, 서버 문구는 "다른 요청 내용이 도착" 이라
 * 사용자가 실패로 읽고 재시도한다.
 *
 * 나머지 거부는 서버 문구가 그대로 정확하므로 가로채면 안 된다 — 그걸 안내로 덮으면 진짜 원인이
 * 사라진다.
 */

const failResponse = (errorCode: string, errorMsg: string): ApiFailResponse => ({
  success: false,
  data: null,
  errorCode,
  errorMsg,
})

const translate = (key: string): string => `translated:${key}`

test('IDEMPOTENCY_CONFLICT 는 서버 문구 대신 안내 문구로 바꾼다', () => {
  const error = new ApiError(
    failResponse(
      'IDEMPOTENCY_CONFLICT',
      '같은 Idempotency-Key 에 다른 요청 내용이 도착했습니다. operationId=op-1',
    ),
    409,
  )

  const message = resolveAcceptanceErrorMessage(error, 'fallback', translate)

  assert.equal(message, `translated:${IDEMPOTENCY_CONFLICT_HINT_KEY}`)
})

test('RESOURCE_BUSY 는 서버 문구를 그대로 보여준다', () => {
  const error = new ApiError(failResponse('RESOURCE_BUSY', '같은 설비의 다른 작업이 진행 중입니다.'), 409)

  const message = resolveAcceptanceErrorMessage(error, 'fallback', translate)

  assert.equal(message, '같은 설비의 다른 작업이 진행 중입니다.')
})

test('COORDINATION_UNAVAILABLE 은 서버 문구를 그대로 보여준다', () => {
  const error = new ApiError(failResponse('COORDINATION_UNAVAILABLE', 'cluster epoch mismatch'), 503)

  const message = resolveAcceptanceErrorMessage(error, 'fallback', translate)

  assert.equal(message, 'cluster epoch mismatch')
})

test('ApiError 가 아닌 예외는 fallback 으로 떨어진다', () => {
  const message = resolveAcceptanceErrorMessage({ nope: true }, 'fallback', translate)

  assert.equal(message, 'fallback')
})
