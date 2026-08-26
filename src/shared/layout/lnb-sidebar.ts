import { cn } from '@/lib/utils'

/**
 * 페이지 안 2차 내비 사이드바의 공용 className 헬퍼.
 *
 * 도메인 사이드바(EqpSidebar / ModelSidebar …)는 데이터·선택 모델이 달라 컴포넌트는
 * 분리하되(R4 — 도메인별 사이드바), 시각 언어(그룹 헤더 / 들여쓴 하위 링크 / 리프 + dot /
 * active·hover 전환)는 동일해야 한다. 그 클래스를 한곳에 모아 도메인 사이드바가 공유한다.
 *
 * active 표시는 전역 LNB 항목({@code SidebarMenuButton})과 같은 축이다 — 중립 surface +
 * brand 글자색 + 머리카락 굵기 inset ring. 코랄을 면(solid block)으로 칠하지 않아 사이드바
 * 전체가 주황으로 읽히지 않게 한다는 기존 원칙은 그대로다(코랄은 글자와 테두리로만).
 * 두 사이드바가 active 를 서로 다른 방식(좌측 보더 vs 면+링)으로 그리면 같은 앱에서 선택
 * 표시가 두 종류로 읽히므로 LNB 쪽으로 통일한다.
 */

export const LNB_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * `<Button>` 기본 크기/정렬 무력화.
 *
 * 아래 헬퍼들은 전부 `<Button>` 에 붙는다. Button 의 `size` 는 `h-9` 를, base 는
 * `justify-center` 를 걸어 두므로 패딩 기반 높이와 좌측 정렬이 깨진다 — 뒤따르는 layout 이
 * 높이를 정하는 경우(그룹 머리글 `h-7`)를 위해 맨 앞에 둔다(twMerge 는 나중 클래스가 이긴다).
 */
const LNB_BUTTON_RESET = 'h-auto justify-start'

/** 항목 active — 전역 LNB `SidebarMenuButton` 의 active 와 같은 표현이다. */
const LNB_ITEM_ACTIVE =
  'bg-muted font-semibold text-brand-accent shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--brand-primary)_16%,transparent)]'

/** 항목 idle — 같은 축의 hover 면. */
const LNB_ITEM_IDLE = 'text-muted-foreground hover:bg-muted hover:text-foreground'

const lnbItemClass = (selected: boolean, layout: string) =>
  cn(
    'transition-[color,background-color,box-shadow]',
    LNB_BUTTON_RESET,
    LNB_FOCUS_RING,
    layout,
    selected ? LNB_ITEM_ACTIVE : LNB_ITEM_IDLE,
  )

/** 그룹 머리글 타이포 — 전역 LNB `SidebarGroupButton` 과 같은 치수·색 축이다. */
const LNB_GROUP_TYPOGRAPHY =
  'flex h-7 w-full shrink-0 items-center gap-2 rounded-md px-1 text-xs font-semibold tracking-wide'

/**
 * 접히지 않는 그룹의 머리글 라벨입니다.
 *
 * <p>버튼이 아니므로 hover·focus 상태를 두지 않는다 — 누를 수 있는 것처럼 보이면 안 된다. 아코디언
 * 그룹과 달리 회전 chevron 도 없다: chevron 의 유무가 곧 접힘 가능 여부다.</p>
 */
export const LNB_GROUP_LABEL = cn(LNB_GROUP_TYPOGRAPHY, 'text-muted-foreground')

/**
 * 아코디언 그룹 헤더 — 전역 LNB `SidebarGroupButton` 과 같은 치수·색 축입니다.
 *
 * <p>열림/닫힘을 나타내는 회전 chevron 은 호출부가 라벨 옆에 그린다(LNB 와 동일). 그룹 헤더는
 * 이동 대상이 아니라 접힘 스위치라 항목처럼 면을 칠하지 않는다.</p>
 */
export const lnbGroupClass = (selected: boolean) =>
  cn(
    LNB_BUTTON_RESET,
    LNB_GROUP_TYPOGRAPHY,
    'transition-colors',
    LNB_FOCUS_RING,
    selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
  )

/** 하위 그룹 링크(들여쓰기 1단). */
export const lnbSubLinkClass = (selected: boolean) =>
  lnbItemClass(selected, 'block w-full rounded-lg py-1.5 pl-8 pr-3 text-left text-xs font-medium')

/** 리프 노드(들여쓰기 2단 + dot). */
export const lnbLeafClass = (selected: boolean) =>
  lnbItemClass(
    selected,
    'flex w-full items-center gap-2 rounded-lg py-1 pl-11 pr-2 text-left text-xs',
  )

/** 리프 노드 좌측 dot. */
export const lnbLeafDotClass = (selected: boolean) =>
  cn('inline-block size-1.5 shrink-0 rounded-full', selected ? 'bg-brand-primary' : 'bg-muted-foreground/50')
