import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TableSectionHeader } from './TableSectionHeader'

interface PageCardProps {
  /** card-header 의 제목. 생략 시 헤더 미표시 (body only). */
  title?: string
  /** card-header 의 아이콘 (제목 좌측). */
  icon?: ReactNode
  /** card-header 우측 액션 (newwindow / 더보기 등). */
  action?: ReactNode
  /** 우측 카운트 pill (총건수 표시). */
  count?: number
  /** 카드 본문. */
  children: ReactNode
  className?: string
  bodyClassName?: string
}

/**
 * nori-client `_dashboard.scss` 의 `.card` (border + radius) 시각 패턴.
 * 헤더는 사용자 결정으로 무채색 plain (`TableSectionHeader`) — 코랄 바 / 밴드 채움 없음.
 */
export function PageCard({
  title,
  icon,
  action,
  count,
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
        <TableSectionHeader
          title={title}
          icon={icon}
          count={count}
          actions={action}
          className="px-5 pt-5"
        />
      ) : null}
      <div className={cn('min-h-0 flex-1 p-5', bodyClassName)}>{children}</div>
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
