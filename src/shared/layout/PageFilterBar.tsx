import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageFilterBarProps {
  /** 조회 조건 컨트롤 (검색 input / select / 날짜 등). */
  children: ReactNode
  /** 우측 정렬 영역 (조회 / 초기화 버튼 등). 생략 가능. */
  actions?: ReactNode
  className?: string
}

/**
 * nori-client 리스트 페이지의 조회 조건 바 (필터/검색 컨트롤 + 우측 액션) 시각 패턴.
 *
 * 2026 재해석 (D10): 카드형 surface (`bg-card` + `border` + `shadow-soft-sm`) 위에 조건 컨트롤을
 * `flex-wrap` 으로 배치, 우측에 조회/초기화 액션. 컨트롤 자체는 페이지가 children 으로 주입
 * (input/select 등 ui-front primitive 재사용 — 내용=ui-front).
 */
export function PageFilterBar({ children, actions, className }: PageFilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-soft-sm',
        className,
      )}
    >
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
