import { Beaker, Cpu, Lock, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { TableRow } from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import { cn } from '@/lib/utils'
import { useBusinessDlq } from '../hooks/useBusinessDlq'
import { useGatewayDlq } from '../hooks/useGatewayDlq'
import { useQuarantine } from '../hooks/useQuarantine'
import { useRepairTasks } from '../hooks/useRepairTasks'
import {
  buildDashboardFeed,
  type DashboardCategory,
  type DashboardFeedItem,
} from '../lib/dlq-feed'
import { formatDlqTime } from '../lib/dlq-format'

interface CategoryStyle {
  label: string
  testId: `dlq-kpi-${DashboardCategory}`
  borderClass: string
  badgeClass: string
  icon: typeof Cpu
}

const CATEGORY_STYLES: Record<DashboardCategory, CategoryStyle> = {
  gateway: {
    label: 'Gateway DLQ',
    testId: 'dlq-kpi-gateway',
    borderClass: 'border-l-4 border-l-blue-400',
    badgeClass: 'bg-blue-50 text-blue-700',
    icon: Cpu,
  },
  business: {
    label: 'Business DLQ',
    testId: 'dlq-kpi-business',
    borderClass: 'border-l-4 border-l-amber-400',
    badgeClass: 'bg-amber-50 text-amber-700',
    icon: Beaker,
  },
  quarantine: {
    label: '격리 설비',
    testId: 'dlq-kpi-quarantine',
    borderClass: 'border-l-4 border-l-red-400',
    badgeClass: 'bg-red-50 text-red-700',
    icon: Lock,
  },
  'repair-task': {
    label: 'Repair Task',
    testId: 'dlq-kpi-repair-task',
    borderClass: 'border-l-4 border-l-violet-400',
    badgeClass: 'bg-violet-50 text-violet-700',
    icon: RotateCcw,
  },
}

const CARD_BASE_CLASS =
  'rounded-[18px] border border-[#E2E9E4] bg-white shadow-[0_10px_30px_-24px_rgba(30,54,40,0.35)]'

const FEED_COLUMNS: ReadonlyArray<ColumnDef<DashboardFeedItem>> = [
  {
    key: 'timestamp',
    header: '발생 시각',
    accessor: (row) => formatDlqTime(row.timestamp),
  },
  {
    key: 'category',
    header: '카테고리',
    accessor: (row) => CATEGORY_STYLES[row.category].label,
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
          {style.label}
        </span>
      )
    },
  },
  {
    key: 'equipmentId',
    header: '설비',
    accessor: (row) => row.equipmentId ?? '-',
  },
  {
    key: 'reasonCode',
    header: '사유 코드',
    accessor: (row) => row.reasonCode ?? '-',
  },
  {
    key: 'reasonMessage',
    header: '사유',
    accessor: (row) => row.reasonMessage ?? '-',
    maxWidth: '24em',
  },
]

interface KpiCardProps {
  category: DashboardCategory
  count: number
  isPending: boolean
  isError: boolean
}

/**
 * 카테고리별 KPI 카드 — 카운트 / 로딩 스켈레톤 / 에러를 격리해서 표시.
 * 로딩 중에는 `data-value` 노드를 skeleton 으로 대체하여 e2e auto-retry 가
 * settled 후의 정확한 카운트를 단언하게 한다 (PLAN §5 위험 6).
 */
function KpiCard({ category, count, isPending, isError }: KpiCardProps) {
  const style = CATEGORY_STYLES[category]
  const Icon = style.icon

  return (
    <div className={cn(CARD_BASE_CLASS, style.borderClass, 'flex flex-col gap-2 p-4')}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-full',
            style.badgeClass,
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-xs font-medium text-[#516058]">{style.label}</span>
      </div>
      {isError ? (
        <span className="text-sm text-[#C5534B]">불러올 수 없습니다</span>
      ) : isPending ? (
        <span
          className="inline-block h-7 w-12 animate-pulse rounded bg-[#EDF1EE]"
          aria-hidden="true"
        />
      ) : (
        <span
          data-testid={style.testId}
          data-value={count}
          className="text-2xl font-semibold text-[#1F2D26]"
        >
          {count}
        </span>
      )}
    </div>
  )
}

/**
 * `/dlq` 진입 시 가장 먼저 보이는 통합 모니터링 패널. 4 카테고리 hook 을 동시에
 * 호출하여 KPI 4 카드 + 최근 장애 20건 통합 피드를 표시한다. polling 없음 —
 * 우상단 새로고침 버튼만 trigger.
 */
export function DashboardPanel() {
  const gatewayQuery = useGatewayDlq()
  const businessQuery = useBusinessDlq()
  const quarantineQuery = useQuarantine()
  const repairQuery = useRepairTasks()

  const allSettled =
    !gatewayQuery.isPending &&
    !businessQuery.isPending &&
    !quarantineQuery.isPending &&
    !repairQuery.isPending

  const anyFetching =
    gatewayQuery.isFetching ||
    businessQuery.isFetching ||
    quarantineQuery.isFetching ||
    repairQuery.isFetching

  const feed = useMemo(() => {
    if (!allSettled) {
      return []
    }
    return buildDashboardFeed(
      gatewayQuery.data ?? [],
      businessQuery.data ?? [],
      quarantineQuery.data ?? [],
      repairQuery.data ?? [],
    )
  }, [
    allSettled,
    gatewayQuery.data,
    businessQuery.data,
    quarantineQuery.data,
    repairQuery.data,
  ])

  const handleRefresh = () => {
    void Promise.all([
      gatewayQuery.refetch(),
      businessQuery.refetch(),
      quarantineQuery.refetch(),
      repairQuery.refetch(),
    ])
  }

  return (
    <div
      data-testid="dlq-dashboard-panel"
      className="flex min-w-0 w-full max-w-full flex-1 flex-col gap-4 p-6"
    >
      <section className={CARD_BASE_CLASS}>
        <div className="flex flex-col gap-3 border-b border-[#EDF1EE] px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-[#243129]">장애 대시보드</h2>
            <p className="text-xs text-[#6C7B72]">
              4 카테고리 통합 현황{anyFetching ? ' · 동기화 중...' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={anyFetching}
              data-testid="dlq-dashboard-refresh"
            >
              새로고침
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 px-6 py-5 lg:grid-cols-4">
          <KpiCard
            category="gateway"
            count={gatewayQuery.data?.length ?? 0}
            isPending={gatewayQuery.isPending}
            isError={gatewayQuery.isError}
          />
          <KpiCard
            category="business"
            count={businessQuery.data?.length ?? 0}
            isPending={businessQuery.isPending}
            isError={businessQuery.isError}
          />
          <KpiCard
            category="quarantine"
            count={quarantineQuery.data?.length ?? 0}
            isPending={quarantineQuery.isPending}
            isError={quarantineQuery.isError}
          />
          <KpiCard
            category="repair-task"
            count={repairQuery.data?.length ?? 0}
            isPending={repairQuery.isPending}
            isError={repairQuery.isError}
          />
        </div>
      </section>

      <section data-testid="dlq-dashboard-feed" className={CARD_BASE_CLASS}>
        <div className="border-b border-[#EDF1EE] px-6 py-4">
          <h3 className="text-sm font-semibold text-[#243129]">최근 장애</h3>
          <p className="text-xs text-[#6C7B72]">시간 역순 상위 20건</p>
        </div>

        <div className="px-6 py-5">
          {!allSettled ? (
            <div className="py-8 text-center text-sm text-[#6C7B72]">불러오는 중입니다.</div>
          ) : feed.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#7B8781]">최근 장애 없음</div>
          ) : (
            <SelectableTable<DashboardFeedItem>
              testId="selectable-table-dashboard-feed"
              columns={FEED_COLUMNS}
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
