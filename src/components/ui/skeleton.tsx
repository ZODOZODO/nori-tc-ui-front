import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 로딩 placeholder — `<TableBody>` 행 자리 / 카드 라인 등에 사용.
 * shadcn/ui 패턴을 nori-tc 디자인 토큰 (#E5EDE9) 으로 이식.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-[#E5EDE9]', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }
