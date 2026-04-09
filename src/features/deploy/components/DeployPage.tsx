import { useEffect, useMemo } from 'react'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { AppTopBar } from '@/shared/components/AppTopBar'
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

  const activePanel = useMemo(() => renderPanel(mode), [mode])

  useEffect(() => {
    return () => {
      clearDeployUiSessionState()
    }
  }, [])

  return (
    <div className="flex min-h-screen min-w-0 w-full flex-col overflow-x-hidden bg-[#F7FAF8]">
      <AppTopBar
        currentMenu="deploy"
        onOpenProfile={() => setProfileModalOpen(true)}
        onAfterLogout={() => {
          clearDeployUiSessionState()
          setProfileModalOpen(false)
        }}
      />
      <div className="h-px bg-[#E5ECE7]" />

      <main className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden">
        <DeploySidebar mode={mode} onChangeMode={setMode} />

        <section className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex min-h-full min-w-0 max-w-full flex-1 p-6">{activePanel}</div>
        </section>
      </main>

      <UserProfileModal open={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  )
}
