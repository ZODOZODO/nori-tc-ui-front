import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PageHeading } from './PageHeading'
import { PageHeadingWithActions } from './PageHeadingWithActions'
import { PageLocation } from './PageLocation'

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
  /** bread crumb (Home › subtitle › name). */
  bread: { subtitle?: string; name: string }
  /** 페이지 제목 영역. */
  heading: { icon?: ReactNode; name: string; description?: string }
  /** 제목 우측 액션 영역. 있으면 PageHeadingWithActions, 없으면 PageHeading. */
  actions?: ReactNode
  /** 콘텐츠 레이아웃 변형. */
  variant?: PageLayoutVariant
  /** 페이지 콘텐츠 (기능 위젯 — D14 내용=ui-front). */
  children: ReactNode
  className?: string
}

/**
 * nori-client 공통 layout 위젯 (Location + SubTitleHeader + TableActions) 의 시각 패턴을
 * 하나로 묶은 통합 wrapper (D14 틀=nori-client). 모든 페이지가 이 shell 위에 콘텐츠를 올린다.
 *
 * 계층: AppPageShell(topbar + wrapper) ⊃ PageLayoutShell(콘텐츠 영역 내부 shell). AppPageShell
 * 은 유지되며 본 컴포넌트는 그 자식 (SPEC R8 L270).
 */
export function PageLayoutShell({
  bread,
  heading,
  actions,
  variant = 'multi-section',
  children,
  className,
}: PageLayoutShellProps) {
  return (
    <section className={cn('flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-6', className)}>
      <PageLocation subtitle={bread.subtitle} name={bread.name} />
      {actions ? (
        <PageHeadingWithActions {...heading} actions={actions} />
      ) : (
        <PageHeading {...heading} />
      )}
      <main className={cn('min-h-0 min-w-0 flex-1', VARIANT_MAIN_CLASS[variant])}>
        {children}
      </main>
    </section>
  )
}
