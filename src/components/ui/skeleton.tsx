import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 로딩 placeholder — `<TableBody>` 행 자리 / 카드 라인 등에 사용.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Skeleton }
