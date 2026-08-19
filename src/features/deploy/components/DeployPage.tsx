import { useCallback, useEffect, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { useMe } from '@/features/profile/hooks/useProfile'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { clampSidebarWidth } from '@/shared/layout/sidebar-layout'
import { DEPLOY_READ_PERMISSION, hasPermission } from '@/shared/lib/permission'
import { useSharedLayoutStore } from '@/shared/stores/shared-layout.store'
import { DeployHistoryPanel } from './DeployHistoryPanel'
import { DeployMonitorPanel } from './DeployMonitorPanel'
import { DeployRegisterPanel } from './DeployRegisterPanel'
import { DeploySidebar } from './DeploySidebar'
import { clearDeployUiSessionState, useDeployUiStore } from '../stores/deploy-ui.store'
import type { DeployMode } from '../types/deploy.types'

const FORBIDDEN_FALLBACK_ROUTE = '/login'

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
  const meQuery = useMe(true)
  const isProfileModalOpen = useDeployUiStore((state) => state.isProfileModalOpen)
  const setProfileModalOpen = useDeployUiStore((state) => state.setProfileModalOpen)
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

  // 메뉴 숨김만으로는 URL 직접 입력·딥링크를 막지 못한다 → 본문 진입도 게이팅한다(S09 E-2).
  if (!hasPermission(meQuery.data?.permissionCodes, DEPLOY_READ_PERMISSION)) {
    return <Navigate to={FORBIDDEN_FALLBACK_ROUTE} replace />
  }

  return (
    <AppPageShell
      currentMenu="deploy"
      onOpenProfile={() => setProfileModalOpen(true)}
      onAfterLogout={() => {
        clearDeployUiSessionState()
        setProfileModalOpen(false)
      }}
    >
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

      <UserProfileModal open={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </AppPageShell>
  )
}
