import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAsyncCommandGuard } from '@/shared/lib/async-command-guard.ts'

/**
 * S09 D-1 / D-2 재현 — 202 + 폴링 구간을 포함하지 않는 in-flight 판정.
 *
 * 결함 당시 `isLifecyclePending` / `isPollingGroupPending` 은 `mutation.isPending` 만 봤다.
 * `mutateAsync` 는 traceId(202) 를 받는 즉시 settle 하므로 그 뒤 최장 60초 폴링
 * (EQP_ASYNC_POLL_INTERVAL_MS 1000 × EQP_ASYNC_MAX_ATTEMPTS 60) 동안 버튼이 되살아나
 * 같은 설비에 EQP_END/EQP_START 또는 EQP_PLC_GROUP_START 가 중복 발행됐다.
 *
 * hook 자체는 mount 할 수 없으므로(jsdom/RTL 미설치) 순수 코어를 직접 검증한다.
 */

/** 폴링 대기를 흉내내는 수동 제어 deferred. */
function createDeferred(): { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } {
  let resolve!: () => void
  let reject!: (e: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('명령이 폴링 구간에 있는 동안 in-flight 가 유지된다', async () => {
  const changes: boolean[] = []
  const guard = createAsyncCommandGuard((running) => changes.push(running))
  const polling = createDeferred()

  const inFlight = guard.run(async () => {
    // mutateAsync(202) 는 이미 settle 한 시점 — 이후 구간이 폴링이다.
    await polling.promise
  })

  assert.equal(guard.isRunning(), true, '폴링 대기 중에는 in-flight 여야 한다')
  assert.deepEqual(changes, [true])

  polling.resolve()
  await inFlight

  assert.equal(guard.isRunning(), false, '폴링 완료 후에는 in-flight 가 풀려야 한다')
  assert.deepEqual(changes, [true, false])
})

test('폴링 구간의 재진입 호출은 명령을 재발행하지 않는다', async () => {
  const guard = createAsyncCommandGuard(() => {})
  const polling = createDeferred()
  let dispatchCount = 0

  const first = guard.run(async () => {
    dispatchCount += 1
    await polling.promise
  })

  // 운영자 재클릭 — 종전에는 여기서 EQP_END/START 가 2회 발행됐다.
  const second = await guard.run(async () => {
    dispatchCount += 1
    await polling.promise
  })

  assert.equal(second.dispatched, false, '재진입은 미발행으로 보고돼야 한다')
  assert.equal(dispatchCount, 1, '명령 발행은 1회여야 한다')

  polling.resolve()
  await first
})

test('명령이 실패해도 in-flight 가 풀린다', async () => {
  const guard = createAsyncCommandGuard(() => {})

  await assert.rejects(
    guard.run(async () => {
      throw new Error('start timeout')
    }),
    /start timeout/,
  )

  assert.equal(guard.isRunning(), false)

  const retry = await guard.run(async () => 'ok')
  assert.deepEqual(retry, { dispatched: true, value: 'ok' })
})

test('발행된 명령의 반환값이 그대로 전달된다', async () => {
  const guard = createAsyncCommandGuard(() => {})
  const result = await guard.run(async () => 42)
  assert.deepEqual(result, { dispatched: true, value: 42 })
})

/**
 * 배선 회귀망 — guard 는 EqpPage 의 두 pending flag 에 실제로 합성돼야 의미가 있다.
 * EqpPage 는 1712 LOC 컴포넌트이고 이 인프라에 jsdom/RTL 이 없어 mount 검증이 불가하므로,
 * D-1/D-2 가 지목한 두 파생식이 guard 를 포함하는지 소스 수준으로 고정한다.
 * (버튼 disabled·스피너의 실제 렌더는 Playwright e2e 담당.)
 */
test('EqpPage 의 lifecycle·pollingGroup pending flag 가 guard 를 포함한다', () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const source = readFileSync(join(root, 'src/features/eqp/components/EqpPage.tsx'), 'utf8')

  const lifecycle = /const isLifecyclePending\s*=\s*([^\n]*(?:\n[^\n]*){0,4}?)\n\n/.exec(source)
  const pollingGroup = /const isPollingGroupPending\s*=\s*([^\n]*(?:\n[^\n]*){0,4}?)\n\n/.exec(source)

  assert.ok(lifecycle, 'isLifecyclePending 파생식을 찾지 못했다')
  assert.ok(pollingGroup, 'isPollingGroupPending 파생식을 찾지 못했다')
  assert.match(lifecycle[1], /lifecycleGuard\.isRunning/, 'D-1 회귀: 폴링 구간이 in-flight 에서 빠졌다')
  assert.match(pollingGroup[1], /pollingGroupGuard\.isRunning/, 'D-2 회귀: 폴링 구간이 in-flight 에서 빠졌다')
})
