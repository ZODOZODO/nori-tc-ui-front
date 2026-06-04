import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface TableSectionHeaderProps {
  title: string
  /** 우측 카운트 pill (총건수 등). 생략 시 미표시. */
  count?: number
  /** 타이틀 좌측 아이콘 (코랄 액센트 바 다음). */
  icon?: ReactNode
  /** 타이틀 아래 보조 설명 줄 (예: 마지막 업데이트). */
  subtitle?: ReactNode
  /** 헤더 우측 액션 영역 (검색 / 새로고침 등). */
  actions?: ReactNode
  className?: string
}

/**
 * 모든 데이터 테이블 섹션의 공통 헤더 — 타이틀(+카운트/보조/액션)만.
 * 사용자 결정으로 코랄 액센트 바 / 카드-헤더 밴드(bg 채움)는 두지 않는다 (무채색 plain).
 */
export function TableSectionHeader({
  title,
  count,
  icon,
  subtitle,
  actions,
  className,
}: TableSectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          {count !== undefined ? (
            <Badge variant="secondary" className="tabular-nums">
              {count.toLocaleString()}
            </Badge>
          ) : null}
        </div>
        {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
