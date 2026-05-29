import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** 페이지 번호 노출 패턴: 1 2 3 4 5 … N (nori-client list_pagination buildPageList 답습). */
const buildPageList = (current: number, pageCount: number): (number | 'ellipsis')[] => {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', pageCount]
  }
  if (current >= pageCount - 3) {
    return [1, 'ellipsis', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', pageCount]
}

interface PagePaginationProps {
  /** 전체 건수. */
  total: number
  /** 현재 페이지 (1-base). */
  page: number
  /** 페이지당 건수. */
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  /** page-size 선택지 (nori-client 기본 [12,25,50,100]). */
  pageSizeOptions?: readonly number[]
  className?: string
}

const PAGE_BTN_BASE =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border bg-background px-2 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40'

/**
 * nori-client `components/list_pagination.jsx` 의 pagination-bar (요약 info + pager + page-size)
 * 시각 패턴을 ui-front 토큰으로 재구성 (D14 틀=nori-client / 색=ui-front coral).
 *
 * 2026 재해석 (D10): active page = `bg-brand-primary text-white` (nori-client `.active` → coral),
 * 요약은 i18n 결합을 피해 숫자 포맷 (`from–to / total`) 직접 노출 (D-I18N — ui-front i18n-context 유지).
 */
export function PagePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [12, 25, 50, 100],
  className,
}: PagePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(page, 1), pageCount)
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, total)
  const pages = buildPageList(safePage, pageCount)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm',
        className,
      )}
    >
      <div className="tabular-nums text-muted-foreground">
        {from.toLocaleString()}–{to.toLocaleString()} / {total.toLocaleString()}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={PAGE_BTN_BASE}
          disabled={safePage === 1}
          onClick={() => onPageChange(1)}
          aria-label="first page"
        >
          <ChevronsLeft className="size-3.5" />
        </button>
        <button
          type="button"
          className={PAGE_BTN_BASE}
          disabled={safePage === 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="previous page"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span
              key={`ellipsis-${i}`}
              aria-hidden
              className="px-1 text-muted-foreground/60"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={cn(
                PAGE_BTN_BASE,
                p === safePage &&
                  'border-brand-primary bg-brand-primary font-semibold text-white hover:bg-brand-primary',
              )}
              aria-current={p === safePage ? 'page' : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          className={PAGE_BTN_BASE}
          disabled={safePage === pageCount}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="next page"
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          type="button"
          className={PAGE_BTN_BASE}
          disabled={safePage === pageCount}
          onClick={() => onPageChange(pageCount)}
          aria-label="last page"
        >
          <ChevronsRight className="size-3.5" />
        </button>
      </div>

      <Select
        value={String(pageSize)}
        onValueChange={(value) => onPageSizeChange(Number(value))}
      >
        <SelectTrigger className="h-8 w-[5.5rem]" aria-label="page size">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {pageSizeOptions.map((opt) => (
            <SelectItem key={opt} value={String(opt)}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
