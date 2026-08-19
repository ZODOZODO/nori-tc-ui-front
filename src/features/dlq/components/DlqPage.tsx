import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { clampSidebarWidth } from '@/shared/layout/sidebar-layout'
import { useSharedLayoutStore } from '@/shared/stores/shared-layout.store'
import type { DlqMode } from '../types/dlq.types'
import { BusinessDlqPanel } from './BusinessDlqPanel'
import { DashboardPanel } from './DashboardPanel'
import { DlqSidebar } from './DlqSidebar'
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
 * (RequireAuth / RequirePermission)가 담당한다. 모드는 URL 세그먼트가 정하며, 모드 전환은
 * navigate 다(새로고침·딥링크가 그대로 복원된다).
 */
export function DlqPage({ mode }: DlqPageProps) {
  const navigate = useNavigate()
  const sidebarOpen = useSharedLayoutStore((state) => state.sidebarOpen)
  const sidebarWidth = useSharedLayoutStore((state) => state.sidebarWidth)
  const toggleSidebar = useSharedLayoutStore((state) => state.toggleSidebar)
  const setSidebarWidth = useSharedLayoutStore((state) => state.setSidebarWidth)

  const handleSidebarDrag = useCallback(
    (deltaX: number) => {
      if (!sidebarOpen) {
        return
      }
      setSidebarWidth(clampSidebarWidth(sidebarWidth + deltaX))
    },
    [setSidebarWidth, sidebarOpen, sidebarWidth],
  )

  const activePanel = useMemo(() => renderPanel(mode), [mode])

  return (
    <AppShellPage>
      <main className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden">
        <DlqSidebar
          mode={mode}
          onChangeMode={(nextMode) => navigate(`/dlq/${nextMode}`)}
          sidebarOpen={sidebarOpen}
          sidebarWidth={sidebarWidth}
          onToggleSidebar={toggleSidebar}
          onResizeSidebar={handleSidebarDrag}
        />

        <section className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {activePanel}
        </section>
      </main>
    </AppShellPage>
  )
}
