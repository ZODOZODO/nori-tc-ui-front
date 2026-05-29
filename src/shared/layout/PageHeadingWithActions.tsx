import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeadingWithActionsProps {
  /** heading-icon 위치의 아이콘 (lucide 등). */
  icon?: ReactNode
  /** 페이지 제목 (heading-primary 의 name). 페이지의 h1. */
  name: string
  /** 제목 아래 보조 설명. */
  description?: string
  /** 우측 정렬 액션 영역 (버튼 group 등). */
  actions?: ReactNode
  className?: string
}

/**
 * nori-client `components/header_subtitle_btn.jsx` 의 heading + 우측 버튼 group 시각 패턴.
 *
 * heading-primary 좌측 + actions 우측 (`flex-space-between`) + hr. PageHeading 과 동일한
 * 2026 재해석 규칙 (D10). 제목/액션이 함께 필요한 페이지용 — PageActionBar 와 통합 가능.
 */
export function PageHeadingWithActions({
  icon,
  name,
  description,
  actions,
  className,
}: PageHeadingWithActionsProps) {
  return (
    <div className={cn('flex flex-col gap-1 border-b border-border pb-3', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-brand-primary [&_svg]:size-5">{icon}</span> : null}
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
            {name}
          </h1>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {description ? (
        <p className="text-sm leading-body text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
