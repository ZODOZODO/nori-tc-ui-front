import { cn } from '@/lib/utils'

interface PageFooterProps {
  /** 저작권 표기 연도. 호출부가 명시 (Date 부수효과를 컴포넌트 밖으로). */
  year: number
  className?: string
}

/**
 * nori-client `components/footer.jsx` (copyright 한 줄) 시각 패턴.
 *
 * 2026 재해석 (D10): muted 색 + 작은 타이포 + 상단 보더. 연도는 순수성 유지를 위해 prop 으로 받는다.
 */
export function PageFooter({ year, className }: PageFooterProps) {
  return (
    <footer
      className={cn(
        'border-t border-border py-4 text-center text-xs text-muted-foreground',
        className,
      )}
    >
      Copyright © {year} NORI. All rights reserved.
    </footer>
  )
}
