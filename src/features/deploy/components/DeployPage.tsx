import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { clampSidebarWidth } from '@/shared/layout/sidebar-layout'
import { useSharedLayoutStore } from '@/shared/stores/shared-layout.store'
import { DeployHistoryPanel } from './DeployHistoryPanel'
import { DeployMonitorPanel } from './DeployMonitorPanel'
import { DeployRegisterPanel } from './DeployRegisterPanel'
import { DeploySidebar } from './DeploySidebar'
import { clearDeployUiSessionState } from '../stores/deploy-ui.store'
import type { DeployMode } from '../types/deploy.types'

interface DeployPageProps {
  /** 표시할 모드. 라우트가 정한다 — URL 이 단일 진실 원천이다. */
  mode: DeployMode
}

const renderPanel = (mode: DeployMode) => {
  switch (mode) {
    case 'register':
      return <DeployRegisterPanel />
    case 'deploy':
      return <DeployMonitorPanel />
    case 'history':
      return <DeployHistoryPanel />
  }
}

export function DeployPage({ mode }: DeployPageProps) {
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

  useEffect(() => {
    return () => {
      clearDeployUiSessionState()
    }
  }, [])

  return (
    <AppShellPage onAfterLogout={clearDeployUiSessionState}>
      <main className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden">
        <DeploySidebar
          mode={mode}
          onChangeMode={(nextMode) => navigate(`/deploy/${nextMode}`)}
          sidebarOpen={sidebarOpen}
          sidebarWidth={sidebarWidth}
          onToggleSidebar={toggleSidebar}
          onResizeSidebar={handleSidebarDrag}
        />

        <section className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex min-h-full min-w-0 max-w-full flex-1 p-6">{activePanel}</div>
        </section>
      </main>
    </AppShellPage>
  )
}
