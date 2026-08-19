import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AppPageHeading } from './AppPageHeading'

/**
 * 페이지 콘텐츠 영역의 레이아웃 변형.
 *
 * 6 값으로 **고정** (Plan §Phase 1.7 위험 L51 — Phase 2~8 진입 시 prop 추가 금지).
 * 현재는 `single-card` / `multi-section` 만 분기 스타일을 가지며, 나머지 4 값은
 * 기본(multi-section) 레이아웃으로 동작한다 — 각 phase 진입 시 해당 페이지에서 스타일을
 * 채운다 (premature abstraction 회피, 사용자 결정 2026-05-29).
 */
export type PageLayoutVariant =
  | 'single-card'
  | 'multi-section'
  | 'split-tab'
  | 'dashboard-grid'
  | 'form-sidebar'
  | 'dashboard-3d'

const VARIANT_MAIN_CLASS: Record<PageLayoutVariant, string> = {
  'single-card': 'mx-auto w-full max-w-md',
  'multi-section': 'flex flex-col gap-6',
  // 아래 4 값은 소비 phase 진입 시 스타일 확정 (현재 base = multi-section).
  'split-tab': 'flex flex-col gap-6',
  'dashboard-grid': 'flex flex-col gap-6',
  'form-sidebar': 'flex flex-col gap-6',
  'dashboard-3d': 'flex flex-col gap-6',
}

interface PageLayoutShellProps {
  /** 페이지 제목 영역. 아이콘은 라우트에서 자동 유도된다({@link AppPageHeading}). */
  heading: { name: string; description?: string }
  /** 제목 우측 액션 영역. */
  actions?: ReactNode
  /** 콘텐츠 레이아웃 변형. */
  variant?: PageLayoutVariant
  /** 페이지 콘텐츠 (기능 위젯 — D14 내용=ui-front). */
  children: ReactNode
  className?: string
}

/**
 * nori-client 공통 layout 위젯 (SubTitleHeader + TableActions) 의 시각 패턴을 하나로 묶은 통합
 * wrapper (D14 틀=nori-client). 모든 페이지가 이 shell 위에 콘텐츠를 올린다.
 *
 * 계층: AppPageShell(LNB + topbar + wrapper) ⊃ PageLayoutShell(콘텐츠 영역 내부 shell).
 * breadcrumb 은 페이지가 아니라 상단 헤더(AppTopBar)가 라우트에서 유도해 그리므로 `bread` prop 은
 * 두지 않는다 — 같은 정보를 두 곳에서 그리면 어긋난다.
 */
export function PageLayoutShell({
  heading,
  actions,
  variant = 'multi-section',
  children,
  className,
}: PageLayoutShellProps) {
  return (
    <section className={cn('flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-5 lg:p-6', className)}>
      <AppPageHeading {...heading} actions={actions} />
      <main className={cn('min-h-0 min-w-0 flex-1', VARIANT_MAIN_CLASS[variant])}>{children}</main>
    </section>
  )
}
