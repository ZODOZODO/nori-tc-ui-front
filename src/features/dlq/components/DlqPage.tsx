import { useMemo } from 'react'
import { useI18n } from '@/i18n/i18n-context'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { AppPageHeading } from '@/shared/layout/AppPageHeading'
import type { DlqMode } from '../types/dlq.types'
import { BusinessDlqPanel } from './BusinessDlqPanel'
import { DashboardPanel } from './DashboardPanel'
import { GatewayDlqPanel } from './GatewayDlqPanel'
import { QuarantinePanel } from './QuarantinePanel'
import { RepairTaskPanel } from './RepairTaskPanel'

interface DlqPageProps {
  /** 표시할 모드. 라우트가 정한다 — URL 이 단일 진실 원천이다. */
  mode: DlqMode
}

const renderPanel = (mode: DlqMode) => {
  switch (mode) {
    case 'dashboard':
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

/** 제목 아래 설명문의 i18n 키. 모드마다 보여 주는 대상이 달라 문구도 모드별로 갈린다. */
const DESCRIPTION_KEY_BY_MODE: Record<DlqMode, string> = {
  dashboard: 'dlq.page.description.dashboard',
  gateway: 'dlq.page.description.gateway',
  business: 'dlq.page.description.business',
  quarantine: 'dlq.page.description.quarantine',
  'repair-task': 'dlq.page.description.repairTask',
}

/**
 * `/dlq/*` 라우트의 통합 페이지입니다. 인증·DLQ_READ 권한 검사는 라우트 가드
 * (RequireAuth / RequirePermission)가 담당한다.
 *
 * 5 모드 전환은 전역 LNB 가 맡는다 — 같은 항목을 in-page 사이드바로 한 번 더 보여주지 않는다.
 */
export function DlqPage({ mode }: DlqPageProps) {
  const { t } = useI18n()
  const activePanel = useMemo(() => renderPanel(mode), [mode])

  return (
    <AppShellPage>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-5 lg:p-6">
        <AppPageHeading description={t(DESCRIPTION_KEY_BY_MODE[mode])} />
        {/* 세로 스크롤을 이 main 이 갖는다 — 패널이 자체 스크롤 컨테이너를 두지 않으므로
            여기서 빼면 셸의 overflow-hidden 에 걸려 목록이 잘린다(실측 376~536px). */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden">
          {activePanel}
        </main>
      </section>
    </AppShellPage>
  )
}
