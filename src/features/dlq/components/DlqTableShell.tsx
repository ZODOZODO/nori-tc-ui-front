import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/i18n-context'
import { resolveDateLocale } from '@/shared/lib/date-locale'
import { PagePagination } from '@/shared/layout/PagePagination'
import { TableSectionHeader } from '@/shared/layout/TableSectionHeader'

interface DlqTableShellProps {
  title: string
  testId: string
  /** 필터 적용 후 총건수 (페이지네이션 / 헤더 pill 기준). */
  totalCount: number
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  errorMessage: string | null
  onRefresh: () => void
  lastUpdatedAt: number | null
  /** 콘텐츠 키워드 검색 (전체 메모리 목록 대상). */
  searchKeyword: string
  onSearchChange: (value: string) => void
  /** 현재 페이지 (1-base). */
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  emptyMessage: string
  children: ReactNode
}

const formatLastUpdated = (epochMs: number | null): string => {
  if (epochMs === null) {
    return '-'
  }

  return new Intl.DateTimeFormat(resolveDateLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(epochMs))
}

/**
 * 4 DLQ 패널의 공통 외곽 — nori-client 리스트 페이지 틀(헤더 + 총건수 pill + 조회 조건 바 +
 * list_pagination)을 ui-front coral 토큰으로 재구성한다. 표 본체는 children 으로 주입.
 * 전체 목록이 메모리에 있으므로(클라 페이지네이션) 콘텐츠 키워드 검색 + PagePagination 을 제공.
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
  searchKeyword,
  onSearchChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  emptyMessage,
  children,
}: DlqTableShellProps) {
  const { t } = useI18n()

  return (
    <div data-testid={testId} className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-6">
      <section className="rounded-xl border border-border bg-card shadow-soft-sm">
        <TableSectionHeader
          title={title}
          count={totalCount}
          className="border-b border-border px-6 py-4"
          subtitle={
            <>
              {t('dlq.table.lastUpdated')}: {formatLastUpdated(lastUpdatedAt)}
              {isFetching ? ` · ${t('dlq.table.syncing')}` : ''}
            </>
          }
          actions={
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={searchKeyword}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={t('dlq.table.searchPlaceholder')}
                  className="h-9 w-56 pl-8"
                  data-testid={`${testId}-search`}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isFetching}
                data-testid={`${testId}-refresh`}
              >
                {t('dlq.table.refresh')}
              </Button>
            </>
          }
        />

        <div className="overflow-x-auto px-6 py-5">
          {isLoading ? (
            <div
              className="space-y-2 py-2"
              data-testid={`${testId}-loading`}
              role="status"
              aria-label={t('dlq.table.loadingAria')}
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-danger">
              <span>{errorMessage ?? t('dlq.table.loadError')}</span>
              <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
                {t('dlq.table.retry')}
              </Button>
            </div>
          ) : totalCount === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
          ) : (
            children
          )}
        </div>

        {totalCount > 0 && !isError ? (
          <div className="border-t border-border px-6 py-4">
            <PagePagination
              total={totalCount}
              page={page}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              pageSizeOptions={[20, 50, 100]}
              className="border-t-0 pt-0"
            />
          </div>
        ) : null}
      </section>
    </div>
  )
}
