import assert from 'node:assert/strict'
import test from 'node:test'
import { apiClient } from '@/shared/lib/api-client.ts'
import {
  ApiError,
  assertSuccessResponse,
  resolveSuccessPayload,
} from '@/shared/lib/api-error.ts'
import { eqpApi } from '@/features/eqp/api/eqp.api.ts'
import { groupApi } from '@/features/group/api/group.api.ts'
import { layoutApi } from '@/features/live-map/api/layout.api.ts'
import { modelApi } from '@/features/model/api/model.api.ts'
import { modelFlowApi } from '@/features/model/api/model-flow.api.ts'
import { userApi } from '@/features/user/api/user.api.ts'
import type { UserPasswordResetRequest } from '@/features/user/types/user.types.ts'

/**
 * `Promise<void>` 를 반환하는 API 함수는 백엔드가 `ApiResponse.success(null)` 을 주는 엔드포인트를
 * 부른다 — 즉 **성공 응답의 data 가 항상 null** 이다.
 *
 * 이 계약을 검증하지 않아 wm-parity-foundation C1-b(`1b429c4`) 에서 `undoEqpCheckout` 하나가
 * `assertSuccessResponse` 대신 `resolveSuccessPayload` 를 부른 채 통과했다. 후자는 data 가 null 이면
 * 던지므로 **성공할 때마다 실패로 보고**했다. 타입도 e2e 도 이 경로를 덮지 못했다.
 */

/** 백엔드가 void 엔드포인트에 주는 성공 봉투. */
const VOID_SUCCESS_ENVELOPE = {
  success: true,
  data: null,
  errorCode: null,
  errorMsg: null,
}

type StubbedVerbs = 'get' | 'post' | 'put' | 'delete'

/**
 * 실제 네트워크 없이 void 성공 응답만 돌려주도록 apiClient 를 monkeypatch 한다.
 * `get` 은 CSRF 쿠키 선발급(`GET /auth/csrf`) 용이라 봉투를 흉내 낼 필요가 없다.
 */
const withVoidSuccessBackend = async (scenario: () => Promise<void>): Promise<void> => {
  const globalWithDocument = globalThis as unknown as { document?: { cookie: string } }
  const originalDocument = globalWithDocument.document
  globalWithDocument.document = { cookie: 'XSRF-TOKEN=test-token' }

  const client = apiClient as unknown as Record<StubbedVerbs, unknown>
  const originals: Partial<Record<StubbedVerbs, unknown>> = {}
  const verbs: StubbedVerbs[] = ['get', 'post', 'put', 'delete']

  for (const verb of verbs) {
    originals[verb] = client[verb]
  }

  client.get = async () => ({ data: {}, status: 200 })
  client.post = async () => ({ data: VOID_SUCCESS_ENVELOPE, status: 200 })
  client.put = async () => ({ data: VOID_SUCCESS_ENVELOPE, status: 200 })
  client.delete = async () => ({ data: VOID_SUCCESS_ENVELOPE, status: 200 })

  try {
    await scenario()
  } finally {
    for (const verb of verbs) {
      client[verb] = originals[verb]
    }

    if (originalDocument === undefined) {
      delete globalWithDocument.document
    } else {
      globalWithDocument.document = originalDocument
    }
  }
}

/** 요청 본문은 stub 이 무시한다 — 이 테스트가 보는 것은 응답 봉투 처리뿐이다. */
const IRRELEVANT_PASSWORD_RESET: UserPasswordResetRequest = { newPassword: 'pw' }

/**
 * `Promise<void>` 를 반환하는 API 함수 전건. 새 void 함수를 만들면 여기에 추가한다.
 *
 * `createEqp` / `updateEqp` / `deleteEqp` 는 여기 없다 — 백엔드가 `202 Accepted` + `operationId`
 * 를 돌려주는 **접수 계약**으로 바뀌어 더 이상 void 가 아니다(§13.2). 그 셋의 회귀망은
 * `eqp-operation-acceptance.test.ts` 다.
 */
const VOID_API_CALLS: ReadonlyArray<readonly [string, () => Promise<void>]> = [
  ['eqpApi.saveEqpEditParams', () => eqpApi.saveEqpEditParams('EQP-1', [])],
  ['eqpApi.undoEqpCheckout', () => eqpApi.undoEqpCheckout('EQP-1')],
  ['eqpApi.checkinEqp', () => eqpApi.checkinEqp('EQP-1', { description: 'desc' })],
  ['groupApi.deleteGroup', () => groupApi.deleteGroup(1)],
  ['groupApi.addMember', () => groupApi.addMember(1, 2)],
  ['groupApi.removeMember', () => groupApi.removeMember(1, 2)],
  ['groupApi.addGroupPermission', () => groupApi.addGroupPermission(1, 2)],
  ['groupApi.removeGroupPermission', () => groupApi.removeGroupPermission(1, 2)],
  ['layoutApi.deleteObject', () => layoutApi.deleteObject(1)],
  ['modelApi.deleteModel', () => modelApi.deleteModel(1)],
  ['modelApi.deleteModelByKey', () => modelApi.deleteModelByKey(1)],
  ['modelApi.deleteBranchModel', () => modelApi.deleteBranchModel(1)],
  ['modelFlowApi.remove', () => modelFlowApi.remove(1, 2)],
  ['userApi.deleteUser', () => userApi.deleteUser(1)],
  ['userApi.resetPassword', () => userApi.resetPassword(1, IRRELEVANT_PASSWORD_RESET)],
]

for (const [name, call] of VOID_API_CALLS) {
  test(`${name} 은 success=true·data=null 응답을 성공으로 처리한다`, async () => {
    await withVoidSuccessBackend(async () => {
      await call()
    })
  })
}

test('assertSuccessResponse 는 data=null 성공 봉투를 통과시킨다', () => {
  assert.doesNotThrow(() => {
    assertSuccessResponse(VOID_SUCCESS_ENVELOPE, 200, 'fallback')
  })
})

test('assertSuccessResponse 는 success=false 봉투를 ApiError 로 던진다', () => {
  assert.throws(
    () => {
      assertSuccessResponse(
        { success: false, data: null, errorCode: 'DENIED', errorMsg: '거부되었습니다' },
        403,
        'fallback',
      )
    },
    (error: unknown) =>
      error instanceof ApiError && error.payload.errorCode === 'DENIED' && error.status === 403,
  )
})

test('resolveSuccessPayload 는 data=null 이면 던진다 — void 엔드포인트에 쓰면 안 되는 이유', () => {
  assert.throws(() => {
    resolveSuccessPayload<{ id: number }>(VOID_SUCCESS_ENVELOPE, 200, 'fallback')
  }, ApiError)
})
