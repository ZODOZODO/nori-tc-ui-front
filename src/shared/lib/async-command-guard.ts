/** 발행 여부까지 알려주는 실행 결과. `dispatched:false` = 이미 실행 중이라 명령을 내지 않았다. */
export type AsyncCommandRunResult<T> = { dispatched: true; value: T } | { dispatched: false }

export interface AsyncCommandGuard {
  isRunning(): boolean
  run<T>(command: () => Promise<T>): Promise<AsyncCommandRunResult<T>>
}

/**
 * 비동기 명령 1건의 실행 구간 전체를 in-flight 로 유지하고 그 구간의 재진입을 차단한다.
 *
 * 이 레포의 비동기 명령은 `mutateAsync` 가 202 + traceId 로 즉시 settle 한 뒤 `/api/async` 를
 * 최장 60초 폴링한다. 따라서 `mutation.isPending` 만으로 버튼을 잠그면 폴링 구간이 열려 같은 명령이
 * 중복 발행된다(S09 D-1 / D-2). in-flight 는 폴링 완료까지 유지돼야 한다.
 *
 * `onRunningChange` 는 React 재렌더 트리거용이고, 재진입 판정은 그 상태가 아니라 동기 플래그로 한다 —
 * `setState` 반영 전에 두 번째 클릭이 도착할 수 있기 때문이다(`EqpPage.handleCheckOut` 의
 * `isCheckoutSubmittingRef` 와 같은 규율).
 */
export function createAsyncCommandGuard(onRunningChange: (running: boolean) => void): AsyncCommandGuard {
  let running = false

  return {
    isRunning: () => running,
    async run<T>(command: () => Promise<T>): Promise<AsyncCommandRunResult<T>> {
      if (running) {
        return { dispatched: false }
      }

      running = true
      onRunningChange(true)
      try {
        return { dispatched: true, value: await command() }
      } finally {
        running = false
        onRunningChange(false)
      }
    },
  }
}
