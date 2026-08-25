import assert from 'node:assert/strict'
import test from 'node:test'
import {
  forgetPendingOperation,
  readPendingOperation,
  rememberPendingOperation,
} from '@/shared/lib/pending-operation-store.ts'

/**
 * 새로고침 후 operationId 재조회의 회귀망(§14.1 마지막 조항).
 *
 * P4 구현은 `operationId` 를 훅의 `useState` 에만 두었다 — 새로고침하면 backend operation 은
 * 살아 있는데 화면이 그것을 가리킬 식별자를 잃어 재조회 자체가 불가능했다. 여기서 고정하는 것:
 *
 * 1. 접수 좌표가 브라우저 저장소에 남고 다시 읽힌다(= 새로고침 후에도 조회 가능).
 * 2. terminal 관측/사용자 확인 시 지워진다.
 * 3. 저장소가 깨졌거나 접근 불가여도 예외를 올리지 않는다(명령 발행을 막지 않는다).
 * 4. 계열(scope)이 서로를 덮어쓰지 않는다.
 */

interface StorageStub {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const installStorage = (storage: StorageStub): void => {
  ;(globalThis as { window?: { localStorage: StorageStub } }).window = { localStorage: storage }
}

const memoryStorage = (): StorageStub => {
  const entries = new Map<string, string>()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value)
    },
  }
}

test('접수 좌표는 저장소에 남아 새로고침 후에도 다시 읽힌다', () => {
  installStorage(memoryStorage())

  rememberPendingOperation('eqp-mutation', {
    operationId: 'op-42',
    action: 'update',
    eqpId: 'EQP-1',
  })

  assert.deepEqual(readPendingOperation('eqp-mutation'), {
    operationId: 'op-42',
    action: 'update',
    eqpId: 'EQP-1',
  })
})

test('계열이 다르면 서로 덮어쓰지 않는다', () => {
  installStorage(memoryStorage())

  rememberPendingOperation('eqp-mutation', { operationId: 'op-1', action: 'create', eqpId: 'E1' })
  rememberPendingOperation('eqp-lifecycle', { operationId: 'op-2', action: 'start', eqpId: 'E2' })

  assert.equal(readPendingOperation('eqp-mutation')?.operationId, 'op-1')
  assert.equal(readPendingOperation('eqp-lifecycle')?.operationId, 'op-2')

  forgetPendingOperation('eqp-lifecycle')

  assert.equal(readPendingOperation('eqp-mutation')?.operationId, 'op-1')
  assert.equal(readPendingOperation('eqp-lifecycle'), null)
})

test('저장소에 깨진 값이 있어도 null 로 돌려주고 예외를 올리지 않는다', () => {
  const storage = memoryStorage()
  storage.setItem('tc.pending-operations.v1', '{"eqp-mutation":{"action":"update"}}')
  installStorage(storage)

  assert.equal(readPendingOperation('eqp-mutation'), null)
})

test('저장소 접근이 실패해도 명령 경로가 예외로 끊기지 않는다', () => {
  installStorage({
    getItem: () => {
      throw new Error('access denied')
    },
    setItem: () => {
      throw new Error('access denied')
    },
  })

  assert.doesNotThrow(() =>
    rememberPendingOperation('eqp-mutation', {
      operationId: 'op-9',
      action: 'delete',
      eqpId: 'E9',
    }),
  )
  assert.equal(readPendingOperation('eqp-mutation'), null)
  assert.doesNotThrow(() => forgetPendingOperation('eqp-mutation'))
})
