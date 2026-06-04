import { useCallback, useEffect, useMemo } from 'react'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { clampSidebarWidth } from '@/shared/layout/sidebar-layout'
import { useSharedLayoutStore } from '@/shared/stores/shared-layout.store'
import { DeployHistoryPanel } from './DeployHistoryPanel'
import { DeployMonitorPanel } from './DeployMonitorPanel'
import { DeployRegisterPanel } from './DeployRegisterPanel'
import { DeploySidebar } from './DeploySidebar'
import { clearDeployUiSessionState, useDeployUiStore } from '../stores/deploy-ui.store'
import type { DeployMode } from '../types/deploy.types'

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

export function DeployPage() {
  const mode = useDeployUiStore((state) => state.mode)
  const isProfileModalOpen = useDeployUiStore((state) => state.isProfileModalOpen)
  const setMode = useDeployUiStore((state) => state.setMode)
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
          onChangeMode={setMode}
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
