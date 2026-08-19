import { createContext, useContext } from 'react'

/** 펼침 폭 — SPEC R1 확정값 256px. */
export const SIDEBAR_WIDTH = '16rem'
/**
 * 접힘 폭 — 아이콘 rail 56px.
 *
 * 접어도 패널을 없애지 않고 그룹 아이콘 rail 을 남긴다 — 완전히 숨기면 접은 상태에서
 * 이동 수단이 사라진다. `SIDEBAR_COLLAPSED_WIDTH_PX`(도메인 in-page 사이드바)와 같은 값이다.
 */
export const SIDEBAR_RAIL_WIDTH = '3.5rem'
/** 펼침/접힘 모션 시간(ms) — SPEC R1 확정값 180ms. */
export const SIDEBAR_TRANSITION_MS = 180
/**
 * 펼침/접힘 상태를 담는 쿠키 이름. 서버 세션과 무관한 순수 표시 상태다.
 *
 * 도메인 in-page 패널 폭(zustand persist `shared-sidebar-layout`)과 채널을 섞지 않는다 —
 * 전역 LNB 는 쿠키, 페이지 안 사이드바는 localStorage 로 각자 산다(SPEC Constraints).
 */
export const SIDEBAR_COOKIE_NAME = 'nori_tc_lnb_state'
/** 쿠키 보존 기간(초) — 7일. */
export const SIDEBAR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
/** 펼침/접힘 토글 키보드 단축키(Ctrl/Cmd + B). */
export const SIDEBAR_KEYBOARD_SHORTCUT = 'b'

export interface SidebarContextValue {
  /** 데스크톱 펼침 여부. */
  open: boolean
  setOpen: (open: boolean) => void
  /** 모바일 off-canvas 열림 여부. */
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  /** 뷰포트가 모바일 폭인지. true 면 off-canvas 모드다. */
  isMobile: boolean
  /** 현재 데스크톱 표시 상태 — 'expanded' | 'collapsed'. */
  state: 'expanded' | 'collapsed'
  /** 현재 모드에 맞는 대상을 토글합니다(모바일이면 off-canvas). */
  toggleSidebar: () => void
}

export const SidebarContext = createContext<SidebarContextValue | null>(null)

/**
 * 상위 `SidebarProvider` 의 LNB 상태를 읽습니다.
 *
 * Provider 밖 사용은 조용히 기본값으로 동작하지 않고 즉시 오류다 — 접힘 상태를 모른 채
 * 렌더하면 tooltip/라벨 표시가 어긋난다.
 */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext)
  if (context === null) {
    throw new Error('useSidebar must be used within a SidebarProvider.')
  }
  return context
}
