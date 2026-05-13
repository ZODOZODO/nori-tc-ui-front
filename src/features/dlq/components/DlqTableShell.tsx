import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface DlqTableShellProps {
  title: string
  testId: string
  totalCount: number
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  errorMessage: string | null
  onRefresh: () => void
  lastUpdatedAt: number | null
  pageIndex: number
  pageCount: number
  canGoPrev: boolean
  canGoNext: boolean
  onMovePage: (nextIndex: number) => void
  emptyMessage: string
  children: ReactNode
}

const cardClassName =
  'rounded-[18px] border border-[#E2E9E4] bg-white shadow-[0_10px_30px_-24px_rgba(30,54,40,0.35)]'

const formatLastUpdated = (epochMs: number | null): string => {
  if (epochMs === null) {
    return '-'
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(epochMs))
}

/**
 * 4 DLQ 패널의 공통 외곽 — 헤더(타이틀/마지막 갱신/새로고침), 로딩/빈/에러 메시지,
 * 클라이언트 페이지네이션 (prev/next) 을 제공한다. 표 본체는 children 으로 주입.
 */
export function DlqTableShell({
  title,
  testId,
  totalCount,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  onRefresh,
  lastUpdatedAt,
  pageIndex,
  pageCount,
  canGoPrev,
  canGoNext,
  onMovePage,
  emptyMessage,
  children,
}: DlqTableShellProps) {
  return (
    <div
      data-testid={testId}
      className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-4 p-6"
    >
      <section className={cardClassName}>
        <div className="flex flex-col gap-3 border-b border-[#EDF1EE] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-[#243129]">{title}</h2>
            <p className="text-xs text-[#6C7B72]">
              마지막 갱신: {formatLastUpdated(lastUpdatedAt)}
              {isFetching ? ' · 동기화 중...' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isFetching}
              data-testid={`${testId}-refresh`}
            >
              새로고침
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto px-6 py-5">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-[#6C7B72]">불러오는 중입니다.</div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-[#C5534B]">
              <span>{errorMessage ?? '목록을 조회하지 못했습니다.'}</span>
              <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
                재시도
              </Button>
            </div>
          ) : totalCount === 0 ? (
            <div className="py-8 text-center text-sm text-[#7B8781]">{emptyMessage}</div>
          ) : (
            children
          )}
        </div>

        {totalCount > 0 && !isError ? (
          <div className="flex flex-col gap-3 border-t border-[#EDF1EE] px-6 py-4 text-xs text-[#5C6A63] md:flex-row md:items-center md:justify-between">
            <span data-testid={`${testId}-pagination-summary`}>
              총 {totalCount}건 · {pageIndex + 1} / {pageCount} 페이지
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canGoPrev}
                onClick={() => onMovePage(pageIndex - 1)}
                data-testid={`${testId}-prev`}
              >
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canGoNext}
                onClick={() => onMovePage(pageIndex + 1)}
                data-testid={`${testId}-next`}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

