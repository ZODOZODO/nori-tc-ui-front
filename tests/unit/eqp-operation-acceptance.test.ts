import assert from 'node:assert/strict'
import test from 'node:test'
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { apiClient, IDEMPOTENCY_KEY_HEADER } from '@/shared/lib/api-client.ts'
import { ApiError } from '@/shared/lib/api-error.ts'
import { eqpApi } from '@/features/eqp/api/eqp.api.ts'
import type { EqpCreateRequest, EqpUpdateRequest } from '@/features/eqp/types/eqp.types.ts'

/**
 * 설비 create / update / delete 의 **202 접수 계약** 회귀망(§13.2 / §14.1).
 *
 * 이 테스트가 대체하는 것은 `eqp-dual-command-timeout.test.ts` 다. 그 테스트는 백엔드가
 * `DeferredResult` 로 gateway + business 응답을 동기로 기다린다는 전제 위에 "요청별 타임아웃이
 * 공용 기본값보다 커야 한다" 를 고정했다. 백엔드가 접수(202) + operation 조회로 바뀌면서
 * 그 전제가 사라졌고, 대신 지켜야 할 계약이 셋으로 바뀌었다.
 *
 * 1. 세 호출은 `operationId` 를 담은 접수 결과를 **반환**한다(`Promise<void>` 아님).
 * 2. 상태 변경 요청에는 `Idempotency-Key` 헤더가 항상 실린다(§14.1 — 재시도 중복 접수 차단).
 * 3. 호출부가 키를 직접 실었으면 인터셉터가 **덮어쓰지 않는다**(같은 작업의 재시도가 새
 *    operation 으로 접수되면 중복 변경이 된다).
 */

/** 백엔드 202 접수 응답 봉투. */
const ACCEPTED_ENVELOPE = {
  success: true,
  data: {
    operationId: 'op-1',
    status: 'PENDING',
    phase: 'ACCEPTED',
    errorCode: null,
    errorMsg: null,
  },
  errorCode: null,
  errorMsg: null,
}

interface CapturedRequest {
  url: string
  method: string
  idempotencyKey: string | undefined
}

/**
 * axios adapter 를 갈아끼워 인터셉터까지 포함한 **전체 요청 파이프라인**을 태운다.
 *
 * `apiClient.post` 등을 monkeypatch 하면 인터셉터가 아예 실행되지 않아 헤더 계약을 검증할 수
 * 없다 — 그래서 메서드가 아니라 adapter 를 대체한다.
 */
const withCapturingBackend = async (
  scenario: (captured: CapturedRequest[]) => Promise<void>,
): Promise<void> => {
  const globalWithDocument = globalThis as unknown as { document?: { cookie: string } }
  const originalDocument = globalWithDocument.document
  globalWithDocument.document = { cookie: 'XSRF-TOKEN=test-token' }

  const originalAdapter = apiClient.defaults.adapter
  const captured: CapturedRequest[] = []

  apiClient.defaults.adapter = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    const method = (config.method ?? 'get').toLowerCase()
    const url = config.url ?? ''
    const idempotencyKey = new Headers(
      Object.entries(config.headers ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ).get(IDEMPOTENCY_KEY_HEADER)

    captured.push({ url, method, idempotencyKey: idempotencyKey ?? undefined })

    // CSRF 선발급(GET /auth/csrf)은 봉투를 흉내 낼 필요가 없다.
    const data = method === 'get' ? {} : ACCEPTED_ENVELOPE
    return {
      data,
      status: method === 'get' ? 200 : 202,
      statusText: '',
      headers: {},
      config: config as AxiosResponse['config'],
    }
  }

  try {
    await scenario(captured)
  } finally {
    apiClient.defaults.adapter = originalAdapter
    if (originalDocument === undefined) {
      delete globalWithDocument.document
    } else {
      globalWithDocument.document = originalDocument
    }
  }
}

const IRRELEVANT_CREATE = { eqpId: 'EQP-1' } as unknown as EqpCreateRequest
const IRRELEVANT_UPDATE = { eqpId: 'EQP-1' } as unknown as EqpUpdateRequest

test('create / update / delete 는 202 접수 결과의 operationId 를 반환한다', async () => {
  await withCapturingBackend(async () => {
    const created = await eqpApi.createEqp(IRRELEVANT_CREATE)
    const updated = await eqpApi.updateEqp('EQP-1', IRRELEVANT_UPDATE)
    const deleted = await eqpApi.deleteEqp('EQP-1')

    for (const [name, acceptance] of [
      ['createEqp', created],
      ['updateEqp', updated],
      ['deleteEqp', deleted],
    ] as const) {
      assert.equal(acceptance.operationId, 'op-1', `${name} 은 operationId 를 돌려줘야 한다`)
      assert.equal(acceptance.status, 'PENDING', `${name} 접수 시점 status`)
      assert.equal(acceptance.phase, 'ACCEPTED', `${name} 접수 시점 phase`)
    }
  })
})

test('상태 변경 요청에는 Idempotency-Key 가 실린다', async () => {
  await withCapturingBackend(async (captured) => {
    await eqpApi.createEqp(IRRELEVANT_CREATE)
    await eqpApi.updateEqp('EQP-1', IRRELEVANT_UPDATE)
    await eqpApi.deleteEqp('EQP-1')

    const mutations = captured.filter((request) => request.method !== 'get')
    assert.equal(mutations.length, 3, 'POST/PUT/DELETE 세 건이 나가야 한다')

    const keys = new Set<string>()
    for (const mutation of mutations) {
      assert.equal(
        typeof mutation.idempotencyKey,
        'string',
        `${mutation.method.toUpperCase()} ${mutation.url} 에 Idempotency-Key 가 없다`,
      )
      keys.add(mutation.idempotencyKey as string)
    }

    // 서로 다른 요청이 같은 키를 쓰면 두 번째 요청이 첫 요청의 replay 로 접수돼 조용히 무시된다.
    assert.equal(keys.size, 3, '요청마다 서로 다른 idempotency key 여야 한다')
  })
})

test('CSRF 선발급 GET 에는 Idempotency-Key 를 붙이지 않는다', async () => {
  await withCapturingBackend(async (captured) => {
    await eqpApi.deleteEqp('EQP-1')

    const reads = captured.filter((request) => request.method === 'get')
    assert.ok(reads.length > 0, 'CSRF 선발급 GET 이 있어야 한다')
    for (const read of reads) {
      assert.equal(read.idempotencyKey, undefined, `GET ${read.url} 에 키가 붙었다`)
    }
  })
})

test('호출부가 실은 Idempotency-Key 를 인터셉터가 덮어쓰지 않는다', async () => {
  await withCapturingBackend(async (captured) => {
    await apiClient.post('/eqp', IRRELEVANT_CREATE, {
      headers: { [IDEMPOTENCY_KEY_HEADER]: 'caller-owned-key' },
    })

    const mutation = captured.find((request) => request.method === 'post')
    assert.ok(mutation, 'POST 요청이 잡혀야 한다')
    assert.equal(
      mutation.idempotencyKey,
      'caller-owned-key',
      '재시도용으로 호출부가 실은 키가 유지돼야 한다',
    )
  })
})

test('접수가 409 로 거부되면 ApiError 로 올라온다', async () => {
  const globalWithDocument = globalThis as unknown as { document?: { cookie: string } }
  const originalDocument = globalWithDocument.document
  globalWithDocument.document = { cookie: 'XSRF-TOKEN=test-token' }
  const originalAdapter = apiClient.defaults.adapter

  apiClient.defaults.adapter = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    const method = (config.method ?? 'get').toLowerCase()
    if (method === 'get') {
      return {
        data: {},
        status: 200,
        statusText: '',
        headers: {},
        config: config as AxiosResponse['config'],
      }
    }
    return {
      data: {
        success: false,
        data: null,
        errorCode: 'RESOURCE_BUSY',
        errorMsg: '같은 설비에 다른 작업이 진행 중입니다.',
      },
      status: 409,
      statusText: '',
      headers: {},
      config: config as AxiosResponse['config'],
    }
  }

  try {
    await assert.rejects(
      () => eqpApi.createEqp(IRRELEVANT_CREATE),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 409 &&
        error.payload.errorCode === 'RESOURCE_BUSY',
    )
  } finally {
    apiClient.defaults.adapter = originalAdapter
    if (originalDocument === undefined) {
      delete globalWithDocument.document
    } else {
      globalWithDocument.document = originalDocument
    }
  }
})
