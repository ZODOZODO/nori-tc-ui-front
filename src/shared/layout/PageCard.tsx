import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageCardProps {
  /** card-header 의 제목. 생략 시 헤더 미표시 (body only). */
  title?: string
  /** card-header 의 아이콘 (제목 좌측). */
  icon?: ReactNode
  /** card-header 우측 액션 (newwindow / 더보기 등). */
  action?: ReactNode
  /** 카드 본문. */
  children: ReactNode
  className?: string
  bodyClassName?: string
}

/**
 * nori-client `_dashboard.scss` 의 `.card` (border + radius) + `.card-header`
 * (flex justify-between + 상단 bg + border-bottom) 시각 패턴.
 *
 * 2026 재해석 (D10): grayscale-50 헤더 → `bg-muted/40`, 단일 그림자 → `shadow-soft-sm`,
 * radius `.5rem` → `rounded-xl`. 현황/대시보드 화면 카드 섹션에 사용 (DeployPage 등).
 */
export function PageCard({
  title,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: PageCardProps) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft-sm',
        className,
      )}
    >
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-brand-primary [&_svg]:size-4">{icon}</span> : null}
            <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn('min-h-0 flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

interface PageCardGridProps {
  children: ReactNode
  className?: string
}

/**
 * nori-client `.dashboard` / `.dashboard-state` 의 카드 grid (auto-fit minmax) 시각 패턴.
 * 카드들을 반응형 grid 로 배치한다 — 최소 폭 미달 시 자동 단 줄임.
 */
export function PageCardGrid({ children, className }: PageCardGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))]',
        className,
      )}
    >
      {children}
    </div>
  )
}
