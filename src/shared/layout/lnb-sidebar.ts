import { cn } from '@/lib/utils'

/**
 * nori-client 리뉴얼 LNB(좌측 내비) 시각 패턴의 공용 className 헬퍼.
 *
 * 도메인 사이드바(EqpSidebar / ModelSidebar …)는 데이터·선택 모델이 달라 컴포넌트는
 * 분리하되(R4 — 도메인별 사이드바), 3단 아코디언의 *시각 언어*(그룹 헤더 / 들여쓴 하위
 * 링크 / 리프 + active 좌측 액센트 / hover 전환)는 동일해야 한다. 그 클래스를 한곳에 모아
 * eqp/model 이 공유한다 (slate/blue 미차용, coral/neutral 토큰).
 */

export const LNB_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** sidebar__top — 최상위 그룹 헤더. 선택(is-expanded) = solid coral. */
export const lnbGroupClass = (selected: boolean) =>
  cn(
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold transition-colors',
    LNB_FOCUS_RING,
    selected
      ? 'bg-brand-primary text-white'
      : 'text-foreground hover:bg-brand-primary/10 hover:text-brand-primary',
  )

/** sidebar__sublink — 하위 그룹 링크(들여쓰기 + active 좌측 보더). */
export const lnbSubLinkClass = (selected: boolean) =>
  cn(
    'block w-full rounded-md py-1.5 pr-3 text-left text-xs font-medium transition-colors',
    LNB_FOCUS_RING,
    selected
      ? 'border-l-2 border-brand-primary bg-brand-primary/10 pl-[30px] font-semibold text-brand-primary'
      : 'pl-8 text-muted-foreground hover:bg-muted hover:text-foreground',
  )

/** 리프 노드(하위 그룹보다 더 깊은 들여쓰기 + dot). active 좌측 보더. */
export const lnbLeafClass = (selected: boolean) =>
  cn(
    'flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-xs transition-colors',
    LNB_FOCUS_RING,
    selected
      ? 'border-l-2 border-brand-primary bg-brand-primary/10 pl-[42px] font-semibold text-brand-primary'
      : 'pl-11 text-muted-foreground hover:bg-muted hover:text-foreground',
  )

/** 리프 노드 좌측 dot. */
export const lnbLeafDotClass = (selected: boolean) =>
  cn('inline-block size-1.5 shrink-0 rounded-full', selected ? 'bg-brand-primary' : 'bg-muted-foreground/50')
