import { useMemo } from 'react'
import { AppShellPage } from '@/shared/components/AppShellPage'
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

/**
 * `/dlq/*` 라우트의 통합 페이지입니다. 인증·DLQ_READ 권한 검사는 라우트 가드
 * (RequireAuth / RequirePermission)가 담당한다.
 *
 * 5 모드 전환은 전역 LNB 가 맡는다 — 같은 항목을 in-page 사이드바로 한 번 더 보여주지 않는다.
 */
export function DlqPage({ mode }: DlqPageProps) {
  const activePanel = useMemo(() => renderPanel(mode), [mode])

  return (
    <AppShellPage>
      <main className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {activePanel}
      </main>
    </AppShellPage>
  )
}
