import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PageMetricTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

export interface PageMetricItem {
  key: string
  label: string
  value: number | string
  icon: LucideIcon
  hint?: string
  tone?: PageMetricTone
  selected?: boolean
  onSelect?: () => void
}

interface PageMetricGridProps {
  items: readonly PageMetricItem[]
  ariaLabel: string
  className?: string
}

const TONE_CLASS: Readonly<
  Record<PageMetricTone, { idle: string; interactive: string; selected: string; icon: string }>
> = {
  neutral: {
    idle: 'border-border bg-card',
    interactive: 'hover:border-muted-foreground/40 hover:bg-muted/35',
    selected: 'border-foreground/35 bg-muted text-foreground',
    icon: 'bg-muted text-muted-foreground',
  },
  brand: {
    idle: 'border-border bg-card',
    interactive: 'hover:border-brand-primary/40 hover:bg-brand-primary/5',
    selected: 'border-brand-primary bg-brand-primary/10 text-foreground',
    icon: 'bg-brand-primary/12 text-brand-accent',
  },
  success: {
    idle: 'border-border bg-card',
    interactive: 'hover:border-success/40 hover:bg-success/5',
    selected: 'border-success bg-success/10 text-foreground',
    icon: 'bg-success/12 text-success',
  },
  warning: {
    idle: 'border-border bg-card',
    interactive: 'hover:border-warning/45 hover:bg-warning/5',
    selected: 'border-warning bg-warning/10 text-foreground',
    icon: 'bg-warning/15 text-warning',
  },
  danger: {
    idle: 'border-border bg-card',
    interactive: 'hover:border-danger/40 hover:bg-danger/5',
    selected: 'border-danger bg-danger/10 text-foreground',
    icon: 'bg-danger/12 text-danger',
  },
}

/**
 * 목록 위에서 전체 규모와 조치가 필요한 상태를 빠르게 비교하는 공통 현황 카드입니다.
 * 클릭 가능한 카드는 단순 통계가 아니라 실제 목록 필터로 연결합니다.
 */
export function PageMetricGrid({ items, ariaLabel, className }: PageMetricGridProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn('grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]', className)}
    >
      {items.map((item) => {
        const tone = TONE_CLASS[item.tone ?? 'neutral']
        const content = (
          <>
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tone.icon)}>
              <item.icon className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-muted-foreground">
                {item.label}
              </span>
              <span className="mt-0.5 block text-xl font-semibold leading-none tabular-nums text-foreground">
                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
              </span>
              {item.hint ? (
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {item.hint}
                </span>
              ) : null}
            </span>
          </>
        )

        if (item.onSelect) {
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={item.selected}
              onClick={item.onSelect}
              className={cn(
                'flex min-w-0 items-center gap-3 rounded-xl border p-3.5 text-left shadow-soft-sm transition-[border-color,background-color,box-shadow] duration-200',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                item.selected ? tone.selected : [tone.idle, tone.interactive],
              )}
            >
              {content}
            </button>
          )
        }

        return (
          <article key={item.key} className={cn('flex min-w-0 items-center gap-3 rounded-xl border p-3.5 shadow-soft-sm', tone.idle)}>
            {content}
          </article>
        )
      })}
    </section>
  )
}
