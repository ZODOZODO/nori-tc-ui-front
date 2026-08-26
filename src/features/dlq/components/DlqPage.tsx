import { useState } from 'react'
import { Beaker, Cpu, Lock, RotateCcw } from 'lucide-react'
import { useI18n } from '@/i18n/i18n-context'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { AppPageHeading } from '@/shared/layout/AppPageHeading'
import { PageMetricGrid } from '@/shared/layout/PageMetricGrid'
import { useDlqCategoryEntries } from '../hooks/useDlqCategoryEntries'
import type { DashboardCategory } from '../lib/dlq-feed'
import { BusinessDlqPanel } from './BusinessDlqPanel'
import { DashboardPanel } from './DashboardPanel'
import { GatewayDlqPanel } from './GatewayDlqPanel'
import { QuarantinePanel } from './QuarantinePanel'
import { RepairTaskPanel } from './RepairTaskPanel'

/**
 * 선택된 카테고리 — `null` 은 아무 카드도 고르지 않은 상태이고, 그때가 통합 대시보드다.
 * 카드는 KPI 이자 목록 진입점이라, 고른 카드를 다시 누르면 대시보드로 돌아온다.
 */
type DlqView = DashboardCategory | null

const renderPanel = (view: DlqView) => {
  switch (view) {
    case null:
      return <DashboardPanel />
    case 'gateway':
      return <GatewayDlqPanel />
    case 'business':
      return <BusinessDlqPanel />
    case 'quarantine':
      return <QuarantinePanel />
    case 'repair-task':
      return <RepairTaskPanel />
  }
}

/**
 * `/dlq` 라우트의 통합 페이지입니다. 인증·DLQ_READ 권한 검사는 라우트 가드
 * (RequireAuth / RequirePermission)가 담당한다.
 *
 * <p>4 카테고리(gateway / business / 격리 / 복구작업)는 서로 다른 화면이 아니라 같은 "막힌 것"의
 * 갈래다 — 건수 카드를 그 갈래의 진입점으로 쓰고, 아무것도 고르지 않은 상태에서는 4 갈래를
 * 시간축으로 합친 대시보드를 보여준다.</p>
 */
export function DlqPage() {
  const { t } = useI18n()
  const [view, setView] = useState<DlqView>(null)
  const entries = useDlqCategoryEntries()

  // 조회가 끝나기 전 0 을 보여주면 "장애 없음" 으로 읽힌다 — 확정 전에는 값을 비운다.
  const count = (length: number): number | string => (entries.isSettled ? length : '—')
  const toggle = (category: DashboardCategory) =>
    setView((current) => (current === category ? null : category))

  return (
    <AppShellPage>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-5 lg:p-6">
        <AppPageHeading description={t('dlq.page.description')} />

        <PageMetricGrid
          className="shrink-0"
          ariaLabel={t('dlq.summary.ariaLabel')}
          items={[
            {
              key: 'gateway',
              testId: 'dlq-kpi-gateway',
              label: t('dlq.panel.gateway'),
              value: count(entries.gateway.length),
              icon: Cpu,
              tone: entries.gateway.length > 0 ? 'danger' : 'neutral',
              selected: view === 'gateway',
              onSelect: () => toggle('gateway'),
            },
            {
              key: 'business',
              testId: 'dlq-kpi-business',
              label: t('dlq.panel.business'),
              value: count(entries.business.length),
              icon: Beaker,
              tone: entries.business.length > 0 ? 'danger' : 'neutral',
              selected: view === 'business',
              onSelect: () => toggle('business'),
            },
            {
              key: 'quarantine',
              testId: 'dlq-kpi-quarantine',
              label: t('dlq.panel.quarantine'),
              value: count(entries.quarantine.length),
              icon: Lock,
              tone: entries.quarantine.length > 0 ? 'warning' : 'neutral',
              selected: view === 'quarantine',
              onSelect: () => toggle('quarantine'),
            },
            {
              key: 'repair-task',
              testId: 'dlq-kpi-repair-task',
              label: t('dlq.panel.repairTask'),
              value: count(entries.repairTask.length),
              icon: RotateCcw,
              tone: entries.repairTask.length > 0 ? 'brand' : 'neutral',
              selected: view === 'repair-task',
              onSelect: () => toggle('repair-task'),
            },
          ]}
        />

        {/* 세로 스크롤을 이 main 이 갖는다 — 패널이 자체 스크롤 컨테이너를 두지 않으므로
            여기서 빼면 셸의 overflow-hidden 에 걸려 목록이 잘린다. */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden">
          {renderPanel(view)}
        </main>
      </section>
    </AppShellPage>
  )
}
