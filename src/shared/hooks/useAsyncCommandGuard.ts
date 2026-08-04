import { useState } from 'react'
import { createAsyncCommandGuard, type AsyncCommandRunResult } from '@/shared/lib/async-command-guard'

interface UseAsyncCommandGuardResult {
  /** 명령 발행부터 폴링 완료까지 true. 버튼 `disabled` / 스피너에 그대로 쓴다. */
  isRunning: boolean
  run<T>(command: () => Promise<T>): Promise<AsyncCommandRunResult<T>>
}

/**
 * 202 + 폴링으로 완결되는 비동기 명령의 in-flight 를 화면에 노출하고 재진입을 막는다.
 *
 * 상세 규율은 {@link createAsyncCommandGuard} 참조. 훅은 재렌더 트리거(state)만 얹는다.
 */
export function useAsyncCommandGuard(): UseAsyncCommandGuardResult {
  const [isRunning, setIsRunning] = useState(false)
  // useState 초기화 함수로 마운트당 1회만 생성 — ref 를 렌더 중에 읽지 않는다(react-hooks/refs).
  const [guard] = useState(() => createAsyncCommandGuard(setIsRunning))

  return { isRunning, run: guard.run }
}
