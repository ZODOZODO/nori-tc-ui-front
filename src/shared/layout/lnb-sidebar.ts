import { cn } from '@/lib/utils'

/**
 * nori-client 리뉴얼 LNB(좌측 내비) 시각 패턴의 공용 className 헬퍼.
 *
 * 도메인 사이드바(EqpSidebar / ModelSidebar …)는 데이터·선택 모델이 달라 컴포넌트는
 * 분리하되(R4 — 도메인별 사이드바), 3단 아코디언의 *시각 언어*(그룹 헤더 / 들여쓴 하위
 * 링크 / 리프 + active 좌측 액센트 / hover 전환)는 동일해야 한다. 그 클래스를 한곳에 모아
 * eqp/model 이 공유한다 (slate/blue 미차용, neutral 토큰 + coral 좌측 액센트 포인트).
 *
 * active = 중립 surface(bg-muted) + 얇은 coral 좌측 보더(point). 코랄을 면(solid block)으로
 * 칠하지 않아 사이드바 전체가 주황으로 읽히지 않게 한다 — 코랄은 포인트로만.
 */

export const LNB_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * `<Button>` 기본 크기/정렬 무력화.
 *
 * 아래 헬퍼들은 전부 `<Button>` 에 붙는다(사이드바 raw `<button>` 수렴 이후). Button 의
 * `size` 는 `h-9` 를, base 는 `justify-center` 를 걸어 두므로 패딩 기반 높이와 좌측 정렬이
 * 깨진다 — 헬퍼가 뒤에 오므로 여기서 되돌린다(twMerge 는 나중 클래스가 이긴다).
 */
const LNB_BUTTON_RESET = 'h-auto justify-start'

/** sidebar__top — 최상위 그룹 헤더. 선택(is-expanded) = 중립 surface + coral 좌측 액센트. */
export const lnbGroupClass = (selected: boolean) =>
  cn(
    'flex w-full items-center gap-2.5 rounded-lg py-2.5 text-left text-[13px] font-bold transition-colors',
    LNB_BUTTON_RESET,
    LNB_FOCUS_RING,
    selected
      ? 'border-l-2 border-brand-primary bg-muted pl-2.5 pr-3 text-foreground'
      : 'px-3 text-foreground hover:bg-muted hover:text-foreground',
  )

/** sidebar__sublink — 하위 그룹 링크(들여쓰기 + active 좌측 보더). */
export const lnbSubLinkClass = (selected: boolean) =>
  cn(
    'block w-full rounded-md py-1.5 pr-3 text-left text-xs font-medium transition-colors',
    LNB_BUTTON_RESET,
    LNB_FOCUS_RING,
    selected
      ? 'border-l-2 border-brand-primary bg-muted pl-7.5 font-semibold text-foreground'
      : 'pl-8 text-muted-foreground hover:bg-muted hover:text-foreground',
  )

/** 리프 노드(하위 그룹보다 더 깊은 들여쓰기 + dot). active 좌측 보더. */
export const lnbLeafClass = (selected: boolean) =>
  cn(
    'flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-xs transition-colors',
    LNB_BUTTON_RESET,
    LNB_FOCUS_RING,
    selected
      ? 'border-l-2 border-brand-primary bg-muted pl-10.5 font-semibold text-foreground'
      : 'pl-11 text-muted-foreground hover:bg-muted hover:text-foreground',
  )

/** 리프 노드 좌측 dot. */
export const lnbLeafDotClass = (selected: boolean) =>
  cn('inline-block size-1.5 shrink-0 rounded-full', selected ? 'bg-brand-primary' : 'bg-muted-foreground/50')
