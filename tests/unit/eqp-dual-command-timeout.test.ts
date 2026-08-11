import assert from 'node:assert/strict'
import test from 'node:test'
import { apiClient } from '@/shared/lib/api-client.ts'
import { eqpApi } from '@/features/eqp/api/eqp.api.ts'

/**
 * 설비 생성 / 수정 / 삭제는 서버가 gateway + business 양쪽 응답을 동기로 기다린다
 * (`EqpController` 의 `DeferredResult`, `tc.ui.backend.async.dual-request-timeout-ms` = 10s).
 * 공용 apiClient 기본 타임아웃도 10s 라, 요청별 override 가 없으면 두 상한이 같아져
 * 서버가 9 초대에 성공(200)해도 브라우저가 먼저 끊는다 — 설비는 만들어졌는데 화면은 실패로
 * 남는 상태가 된다(2026-08-11 실측 9.594s).
 *
 * 그래서 이 3 개 호출은 반드시 공용 기본값보다 큰 타임아웃을 실어야 한다.
 */

interface CapturedConfig {
  timeout?: number
}

const dualSuccessResponse = {
  data: { success: true, data: null, errorCode: null, errorMsg: null },
  status: 200,
}

/** csrf 토큰을 document.cookie 로 주입한다(node:test 는 DOM 이 없다). */
function installFakeDocument(): void {
  ;(globalThis as unknown as { document: { cookie: string } }).document = {
    cookie: 'XSRF-TOKEN=test-token',
  }
}

test('설비 생성 / 수정 / 삭제는 공용 기본 타임아웃보다 큰 값을 실어 보낸다', async () => {
  installFakeDocument()

  const defaultTimeout = apiClient.defaults.timeout
  assert.equal(typeof defaultTimeout, 'number', '공용 apiClient 기본 타임아웃이 설정돼 있어야 한다')

  const originalGet = apiClient.get
  const originalPost = apiClient.post
  const originalPut = apiClient.put
  const originalDelete = apiClient.delete
  const captured: Record<string, CapturedConfig | undefined> = {}

  ;(apiClient as unknown as { get: (...args: unknown[]) => Promise<unknown> }).get = async () => ({
    data: {},
    status: 200,
  })
  ;(
    apiClient as unknown as {
      post: (url: string, body: unknown, config?: CapturedConfig) => Promise<unknown>
    }
  ).post = async (_url, _body, config) => {
    captured.create = config
    return dualSuccessResponse
  }
  ;(
    apiClient as unknown as {
      put: (url: string, body: unknown, config?: CapturedConfig) => Promise<unknown>
    }
  ).put = async (_url, _body, config) => {
    captured.update = config
    return dualSuccessResponse
  }
  ;(
    apiClient as unknown as {
      delete: (url: string, config?: CapturedConfig) => Promise<unknown>
    }
  ).delete = async (_url, config) => {
    captured.delete = config
    return dualSuccessResponse
  }

  try {
    await eqpApi.createEqp({ eqpId: 'EQP-1' } as unknown as Parameters<typeof eqpApi.createEqp>[0])
    await eqpApi.updateEqp('EQP-1', {} as unknown as Parameters<typeof eqpApi.updateEqp>[1])
    await eqpApi.deleteEqp('EQP-1')
  } finally {
    ;(apiClient as unknown as { get: unknown }).get = originalGet
    ;(apiClient as unknown as { post: unknown }).post = originalPost
    ;(apiClient as unknown as { put: unknown }).put = originalPut
    ;(apiClient as unknown as { delete: unknown }).delete = originalDelete
    delete (globalThis as unknown as { document?: unknown }).document
  }

  for (const action of ['create', 'update', 'delete'] as const) {
    const timeout = captured[action]?.timeout
    assert.equal(typeof timeout, 'number', `${action} 요청에 명시 타임아웃이 실려야 한다`)
    assert.ok(
      (timeout as number) > (defaultTimeout as number),
      `${action} 타임아웃(${timeout}ms)은 공용 기본값(${defaultTimeout}ms)보다 커야 한다`,
    )
  }
})
