import assert from 'node:assert/strict'
import test from 'node:test'
import { apiClient } from '@/shared/lib/api-client.ts'
import { eqpApi } from '@/features/eqp/api/eqp.api.ts'

/**
 * AC-B2: reconnectEqp API 가 stuck 복구용 EQP_RECONNECT 엔드포인트(POST /eqp/{id}/reconnect)를 호출하는지 검증한다.
 *
 * axios 인스턴스(apiClient)를 런타임 monkeypatch 하여 실제 네트워크 없이 호출 URL 을 포착한다.
 * (node:test 는 module-mock/DOM 이 없어 csrf 쿠키를 document.cookie 로 주입한다.)
 */
test('AC-B2: reconnectEqp 는 POST /eqp/{id}/reconnect 를 호출한다', async () => {
  // getCookieValue(document.cookie) 가 csrf 토큰을 읽도록 준비
  ;(globalThis as unknown as { document: { cookie: string } }).document = {
    cookie: 'XSRF-TOKEN=test-token',
  }

  const originalGet = apiClient.get
  const originalPost = apiClient.post
  let capturedUrl: string | null = null

  ;(apiClient as unknown as { get: (...args: unknown[]) => Promise<unknown> }).get = async () => ({
    data: {},
    status: 200,
  })
  ;(apiClient as unknown as { post: (url: string) => Promise<unknown> }).post = async (url: string) => {
    capturedUrl = url
    return {
      data: { success: true, data: { traceId: 'trace-reconnect' }, errorCode: null, errorMsg: null },
      status: 202,
    }
  }

  try {
    const traceId = await eqpApi.reconnectEqp('EQP-1', { interfaceType: 'SOCKET', uiMessage: null })
    assert.equal(traceId, 'trace-reconnect')
    assert.equal(capturedUrl, '/eqp/EQP-1/reconnect')
  } finally {
    ;(apiClient as unknown as { get: unknown }).get = originalGet
    ;(apiClient as unknown as { post: unknown }).post = originalPost
    delete (globalThis as unknown as { document?: unknown }).document
  }
})
