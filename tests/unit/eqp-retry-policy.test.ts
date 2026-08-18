import assert from 'node:assert/strict'
import test from 'node:test'
import { isClientRequestError } from '@/features/eqp/utils/eqp-error.util.ts'
import { ApiError } from '@/shared/lib/api-error.ts'

const failResponse = (errorMsg: string) => ({
  success: false as const,
  errorCode: 'BAD_REQUEST',
  errorMsg,
  data: null,
})

test('설비 수 한도 초과(400)는 재시도 대상이 아니다', () => {
  // 실제로 나온 응답: "한 번에 조회 가능한 설비 수는 200개 이하여야 합니다."
  const error = new ApiError(failResponse('한 번에 조회 가능한 설비 수는 200개 이하여야 합니다.'), 400)

  assert.equal(isClientRequestError(error), true)
})

test('인증/권한 실패도 같은 요청을 반복할 이유가 없다', () => {
  assert.equal(isClientRequestError(new ApiError(failResponse('unauthorized'), 401)), true)
  assert.equal(isClientRequestError(new ApiError(failResponse('forbidden'), 403)), true)
  assert.equal(isClientRequestError(new ApiError(failResponse('not found'), 404)), true)
})

test('서버 오류는 재시도 대상이라 client error 로 분류하지 않는다', () => {
  assert.equal(isClientRequestError(new ApiError(failResponse('boom'), 500)), false)
  assert.equal(isClientRequestError(new ApiError(failResponse('bad gateway'), 502)), false)
  assert.equal(isClientRequestError(new ApiError(failResponse('unavailable'), 503)), false)
})

test('status 를 모르는 실패(네트워크 단절 등)는 재시도 대상이다', () => {
  assert.equal(isClientRequestError(new ApiError(failResponse('network down'))), false)
  assert.equal(isClientRequestError(new Error('ECONNRESET')), false)
  assert.equal(isClientRequestError(undefined), false)
})
