import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageActionBarProps {
  /** 액션 컨트롤 (조회 / 등록 / 엑셀 / 검색 / 필터 등). */
  children: ReactNode
  className?: string
}

/**
 * nori-client `components/table_common.jsx` 의 `TableActions` (표 위 액션 영역) 시각 패턴.
 *
 * 2026 재해석 (D10): 우측 정렬 + `gap-2` button group spacing, transition 은 각 버튼이 담당.
 * 표/콘텐츠 위에 놓이는 액션 슬롯 — children 으로 버튼/검색 컨트롤을 받는다.
 */
export function PageActionBar({ children, className }: PageActionBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      {children}
    </div>
  )
}
