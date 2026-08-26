import { Beaker, Cpu, Lock, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { TableRow } from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { useI18n } from '@/i18n/i18n-context'
import { cn } from '@/lib/utils'
import { useDlqCategoryEntries } from '../hooks/useDlqCategoryEntries'
import {
  buildDashboardFeed,
  type DashboardCategory,
  type DashboardFeedItem,
} from '../lib/dlq-feed'
import { formatDlqTime } from '../lib/dlq-format'

interface CategoryStyle {
  // 카테고리 라벨은 기존 dlq.panel.* 키를 재사용한다(렌더 시점 t(labelKey)).
  labelKey: string
  badgeClass: string
  icon: typeof Cpu
}

const CATEGORY_STYLES: Record<DashboardCategory, CategoryStyle> = {
  gateway: {
    labelKey: 'dlq.panel.gateway',
    badgeClass: 'bg-blue-50 text-blue-700',
    icon: Cpu,
  },
  business: {
    labelKey: 'dlq.panel.business',
    badgeClass: 'bg-amber-50 text-amber-700',
    icon: Beaker,
  },
  quarantine: {
    labelKey: 'dlq.panel.quarantine',
    badgeClass: 'bg-red-50 text-red-700',
    icon: Lock,
  },
  'repair-task': {
    labelKey: 'dlq.panel.repairTask',
    badgeClass: 'bg-violet-50 text-violet-700',
    icon: RotateCcw,
  },
}

// 컬럼 헤더/카테고리 라벨 팩토리(C4) — 모듈 상수라 t() 불가 → t 를 받아 렌더 시점 평가.
const buildFeedColumns = (
  t: (key: string) => string,
): ReadonlyArray<ColumnDef<DashboardFeedItem>> => [
  {
    key: 'timestamp',
    header: t('dlq.col.occurredAt'),
    accessor: (row) => formatDlqTime(row.timestamp),
  },
  {
    key: 'category',
    header: t('dlq.col.category'),
    accessor: (row) => t(CATEGORY_STYLES[row.category].labelKey),
    renderCell: (row) => {
      const style = CATEGORY_STYLES[row.category]
      const Icon = style.icon
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            style.badgeClass,
          )}
        >
          <Icon className="size-3" />
          {t(style.labelKey)}
        </span>
      )
    },
  },
  {
    key: 'equipmentId',
    header: t('dlq.col.equipment'),
    accessor: (row) => row.equipmentId ?? '-',
  },
  {
    key: 'reasonCode',
    header: t('dlq.col.reasonCode'),
    accessor: (row) => row.reasonCode ?? '-',
  },
  {
    key: 'reasonMessage',
    header: t('dlq.col.reason'),
    accessor: (row) => row.reasonMessage ?? '-',
    maxWidth: '24em',
  },
]

/**
 * 카테고리 카드를 아무것도 고르지 않았을 때 보이는 통합 대시보드입니다.
 *
 * 4 카테고리를 시간 역순으로 합쳐 최근 장애를 한 줄기로 보여준다. 카테고리별 건수(KPI)는
 * 페이지 상단 현황 카드가 그리므로 여기서 다시 그리지 않는다 — 같은 숫자를 두 번 두지 않는다.
 * polling 없음 — 우상단 새로고침 버튼만 trigger.
 */
export function DashboardPanel() {
  const { t } = useI18n()
  const entries = useDlqCategoryEntries()

  const feedColumns = useMemo(() => buildFeedColumns(t), [t])

  const feed = useMemo(() => {
    if (!entries.isSettled) {
      return []
    }
    return buildDashboardFeed(
      entries.gateway,
      entries.business,
      entries.quarantine,
      entries.repairTask,
    )
  }, [entries.isSettled, entries.gateway, entries.business, entries.quarantine, entries.repairTask])

  return (
    <div
      data-testid="dlq-dashboard-panel"
      className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-6"
    >
      <section
        data-testid="dlq-dashboard-feed"
        className="rounded-xl border border-border bg-card shadow-soft-sm"
      >
        <div className="flex flex-col gap-3 border-b border-border px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">
              {t('dlq.dashboard.recentTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('dlq.dashboard.recentSubtitle')}
              {entries.isFetching ? ` · ${t('dlq.dashboard.syncing')}` : ''}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={entries.refetchAll}
            disabled={entries.isFetching}
            data-testid="dlq-dashboard-refresh"
          >
            {t('dlq.dashboard.refresh')}
          </Button>
        </div>

        <div className="px-6 py-5">
          {!entries.isSettled ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('dlq.dashboard.loading')}
            </div>
          ) : feed.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('dlq.dashboard.feedEmpty')}
            </div>
          ) : (
            <SelectableTable<DashboardFeedItem>
              testId="selectable-table-dashboard-feed"
              columns={feedColumns}
              rows={feed}
              rowKey={(row) => row.id}
              wrapRow={(row, _rowIdx, children) => (
                <TableRow data-testid="dlq-dashboard-feed-row" data-timestamp={row.timestamp}>
                  {children}
                </TableRow>
              )}
            />
          )}
        </div>
      </section>
    </div>
  )
}
