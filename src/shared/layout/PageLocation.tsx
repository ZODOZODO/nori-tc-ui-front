import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageLocationProps {
  /** Home 다음에 오는 상위 분류 (nori-client location.jsx 의 subtitle). 생략 시 Home › name. */
  subtitle?: string
  /** 현재 페이지명 (breadcrumb 의 마지막 항목, aria-current="page"). */
  name: string
  className?: string
}

/**
 * nori-client `components/location.jsx` 의 bread crumb 시각 패턴 (D14 틀=nori-client).
 *
 * 2026 재해석 (D10): 구분자 `·` → chevron `›`, weight 700 → 500(`font-medium`),
 * 채도 절제 (현재 항목만 `text-foreground`, 나머지 `text-muted-foreground`).
 * 라우팅 결합을 피하려 Home 은 link 가 아닌 텍스트 — 본 컴포넌트는 순수 표현용.
 */
export function PageLocation({ subtitle, name, className }: PageLocationProps) {
  const segments = ['Home', ...(subtitle ? [subtitle] : []), name]
  const lastIndex = segments.length - 1

  return (
    <nav aria-label="breadcrumb" className={cn('text-[13px] leading-5', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {segments.map((segment, index) => {
          const isLast = index === lastIndex
          return (
            <Fragment key={`${segment}-${index}`}>
              <li
                className={cn(
                  'font-medium',
                  isLast ? 'text-foreground' : 'text-muted-foreground',
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {segment}
              </li>
              {isLast ? null : (
                <li aria-hidden="true" className="text-muted-foreground/60">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
