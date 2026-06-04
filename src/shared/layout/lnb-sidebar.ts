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

/** sidebar__top — 최상위 그룹 헤더. 선택(is-expanded) = 중립 surface + coral 좌측 액센트. */
export const lnbGroupClass = (selected: boolean) =>
  cn(
    'flex w-full items-center gap-2.5 rounded-lg py-2.5 text-left text-[13px] font-bold transition-colors',
    LNB_FOCUS_RING,
    selected
      ? 'border-l-2 border-brand-primary bg-muted pl-[10px] pr-3 text-foreground'
      : 'px-3 text-foreground hover:bg-muted hover:text-foreground',
  )

/** sidebar__sublink — 하위 그룹 링크(들여쓰기 + active 좌측 보더). */
export const lnbSubLinkClass = (selected: boolean) =>
  cn(
    'block w-full rounded-md py-1.5 pr-3 text-left text-xs font-medium transition-colors',
    LNB_FOCUS_RING,
    selected
      ? 'border-l-2 border-brand-primary bg-muted pl-[30px] font-semibold text-foreground'
      : 'pl-8 text-muted-foreground hover:bg-muted hover:text-foreground',
  )

/** 리프 노드(하위 그룹보다 더 깊은 들여쓰기 + dot). active 좌측 보더. */
export const lnbLeafClass = (selected: boolean) =>
  cn(
    'flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-xs transition-colors',
    LNB_FOCUS_RING,
    selected
      ? 'border-l-2 border-brand-primary bg-muted pl-[42px] font-semibold text-foreground'
      : 'pl-11 text-muted-foreground hover:bg-muted hover:text-foreground',
  )

/** 리프 노드 좌측 dot. */
export const lnbLeafDotClass = (selected: boolean) =>
  cn('inline-block size-1.5 shrink-0 rounded-full', selected ? 'bg-brand-primary' : 'bg-muted-foreground/50')

/**
 * flat nav — 아코디언 없는 단일 레벨 모드 전환 사이드바(deploy/dlq/user)의 항목 버튼.
 * eqp/model 의 아코디언과 active 시각 언어를 통일한다: 중립 surface(bg-muted) + 얇은 coral
 * 좌측 바(point). 이전엔 각 사이드바가 같은 문자열을 인라인 복붙해 lnb 변경 시 어긋났다.
 */
export const lnbFlatNavClass = (selected: boolean) =>
  cn(
    'h-9 justify-start rounded-md text-sm font-medium transition-colors',
    selected
      ? 'border-l-2 border-brand-primary bg-muted pl-[14px] font-semibold text-foreground hover:bg-muted hover:text-foreground'
      : 'pl-4 text-muted-foreground hover:bg-muted hover:text-foreground',
  )
