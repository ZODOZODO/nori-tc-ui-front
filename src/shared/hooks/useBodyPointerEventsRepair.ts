import { useEffect } from 'react'

/**
 * Radix 가 오버레이를 닫은 뒤에도 `document.body` 에 남기는 `pointer-events: none` 을 정리합니다.
 *
 * <p>왜 필요한가 — `@radix-ui/react-dismissable-layer` 는 잠금 직전의 값을 **모듈 전역 변수**
 * `originalBodyPointerEvents` 하나에 담아 두고, 마지막 레이어가 사라질 때 그 값을 되돌린다
 * (dist/index.mjs:15, :72, :81). 컨텍스트 메뉴가 닫히는 것과 다이얼로그가 열리는 것이 겹치면
 * 다이얼로그 쪽이 그 전역 변수에 이미 `"none"` 을 담아 버리고, 닫을 때 그 `"none"` 을 다시
 * 발라 버린다. 그 순간부터 페이지 전체가 클릭·우클릭을 받지 못한다 — 사용자에겐 "화면이 멈췄다"로
 * 보이고, 새로고침 말고는 빠져나올 방법이 없다.</p>
 *
 * <p>2026-08-10 실측 — `/eqp`(컨텍스트 메뉴 → 설비 생성), `/deploy`(이력 우클릭 → 상세 보기),
 * `/model`(섹션 우클릭 → 모델 생성) 세 화면에서 재현. 우클릭으로 오버레이를 여는 화면이
 * 전부 대상이다.</p>
 *
 * <p>고치는 방법 — 오버레이가 언마운트될 때, 아직 열려 있는 Radix 레이어가 하나도 없는데
 * `body` 에 잠금만 남아 있으면 그 잠금을 지운다. 남아 있는 레이어가 있으면 손대지 않는다 —
 * 그때의 `none` 은 정상 동작이다.</p>
 */
/** 언마운트 후 몇 번, 얼마 간격으로 다시 확인할지. 퇴장 애니메이션(200ms)보다 넉넉하게 잡는다. */
const REPAIR_ATTEMPTS = 8
const REPAIR_INTERVAL_MS = 80

export function useBodyPointerEventsRepair(): void {
  useEffect(
    () => () => {
      // 한 번만 보면 놓친다 — 이 훅의 cleanup 은 Radix DismissableLayer 의 cleanup 보다 **먼저**
      // 돌 수 있고(부모가 먼저 정리된다), 그때는 아직 잠금이 걸리기 전이라 고칠 것이 없다.
      // 잠금은 그 뒤에 다시 발라진다. 그래서 짧은 구간 동안 몇 번 더 확인한다.
      let attempt = 0
      const timer = window.setInterval(() => {
        attempt += 1

        const stillLayered =
          document.querySelector('[data-state="open"][data-slot$="-content"]') !== null ||
          document.querySelector('[data-radix-popper-content-wrapper]') !== null

        if (!stillLayered && document.body.style.pointerEvents === 'none') {
          document.body.style.removeProperty('pointer-events')
          window.clearInterval(timer)
          return
        }

        if (attempt >= REPAIR_ATTEMPTS) {
          window.clearInterval(timer)
        }
      }, REPAIR_INTERVAL_MS)
    },
    [],
  )
}
