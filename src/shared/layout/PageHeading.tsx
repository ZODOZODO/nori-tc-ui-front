import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { pageHeadingClassName } from './page-heading-styles'

interface PageHeadingProps {
  /** heading-icon 위치의 아이콘 (lucide 등). 생략 시 아이콘 없이 제목만. */
  icon?: ReactNode
  /** 페이지 제목 (heading-primary 의 name). 페이지의 h1. */
  name: string
  /** 제목 아래 보조 설명. */
  description?: string
  /** 총건수 pill (nori-client `.total-tag`). 숫자면 제목 우측에 pill 노출. */
  total?: number
  className?: string
}

/**
 * nori-client `components/header_subtitle.jsx` 의 heading-primary (icon + name + total-tag + hr)
 * 시각 패턴.
 *
 * 2026 재해석 (D10): weight 700 → `font-semibold`(600), hr `1px solid` → `border-b border-border`
 * (subtle), `.total-tag` → secondary Badge pill. a11y: 페이지 제목을 `<h1>` 로.
 * 아이콘은 맨몸 글리프가 아니라 `bg-brand-primary/10` 틀 안에 놓아 제목과 무게를 맞춘다.
 * 높이 계약은 `page-heading-styles.ts` 가 소유한다(액션 유무와 무관하게 본문 시작점 고정).
 */
export function PageHeading({ icon, name, description, total, className }: PageHeadingProps) {
  return (
    <div className={cn(pageHeadingClassName, className)}>
      <div className="flex items-center gap-2.5">
        {icon ? (
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-accent [&_svg]:size-4.5">
            {icon}
          </span>
        ) : null}
        <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground">
          {name}
        </h1>
        {typeof total === 'number' ? (
          <Badge variant="secondary" className="tabular-nums">
            {total.toLocaleString()}
          </Badge>
        ) : null}
      </div>
      {description ? (
        <p className="text-sm leading-body text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
