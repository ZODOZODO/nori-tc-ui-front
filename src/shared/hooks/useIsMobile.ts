import { useSyncExternalStore } from 'react'

/** LNB 가 off-canvas 로 전환되는 폭 경계(px). Tailwind `md` 와 같은 값이라 CSS/JS 판정이 어긋나지 않는다. */
export const MOBILE_BREAKPOINT_PX = 768

const QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`

const subscribe = (onStoreChange: () => void): (() => void) => {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onStoreChange)
  return () => query.removeEventListener('change', onStoreChange)
}

const getSnapshot = (): boolean => window.matchMedia(QUERY).matches

/**
 * 뷰포트가 모바일 폭인지 구독합니다(LNB off-canvas 판정용).
 *
 * 첫 렌더부터 실제 폭을 읽으므로 desktop → mobile 로 깜빡이지 않는다. 상태 복제 없이
 * media query 를 직접 외부 store 로 읽어 effect 안 setState 를 만들지 않는다.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot)
}
