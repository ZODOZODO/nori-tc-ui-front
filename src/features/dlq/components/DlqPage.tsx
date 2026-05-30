import { useCallback, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { useMe } from '@/features/profile/hooks/useProfile'
import { useI18n } from '@/i18n/i18n-context'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { clampSidebarWidth } from '@/shared/layout/sidebar-layout'
import { DLQ_READ_PERMISSION, hasPermission } from '@/shared/lib/permission'
import { useSharedLayoutStore } from '@/shared/stores/shared-layout.store'
import { useDlqUiStore } from '../stores/dlq-ui.store'
import type { DlqMode } from '../types/dlq.types'
import { BusinessDlqPanel } from './BusinessDlqPanel'
import { DashboardPanel } from './DashboardPanel'
import { DlqSidebar } from './DlqSidebar'
import { GatewayDlqPanel } from './GatewayDlqPanel'
import { QuarantinePanel } from './QuarantinePanel'
import { RepairTaskPanel } from './RepairTaskPanel'

const FORBIDDEN_FALLBACK_ROUTE = '/login'

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
 * `/dlq` 라우트의 통합 페이지입니다. DLQ_READ 권한 없는 사용자는 /login 으로 리다이렉트됩니다.
 * 좌측 사이드바에서 Gateway / Business / Quarantine / Repair Task 모드를 전환합니다.
 */
export function DlqPage() {
  const { t } = useI18n()
  const meQuery = useMe(true)
  const mode = useDlqUiStore((state) => state.mode)
  const setMode = useDlqUiStore((state) => state.setMode)
  const isProfileModalOpen = useDlqUiStore((state) => state.isProfileModalOpen)
  const setProfileModalOpen = useDlqUiStore((state) => state.setProfileModalOpen)
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

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        {t('dlq.page.loading')}
      </div>
    )
  }

  if (!hasPermission(meQuery.data?.permissionCodes, DLQ_READ_PERMISSION)) {
    return <Navigate to={FORBIDDEN_FALLBACK_ROUTE} replace />
  }

  return (
    <AppPageShell
      currentMenu="dlq"
      onOpenProfile={() => setProfileModalOpen(true)}
      onAfterLogout={() => setProfileModalOpen(false)}
    >
      <main className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden">
        <DlqSidebar
          mode={mode}
          onChangeMode={setMode}
          sidebarOpen={sidebarOpen}
          sidebarWidth={sidebarWidth}
          onToggleSidebar={toggleSidebar}
          onResizeSidebar={handleSidebarDrag}
        />

        <section className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {activePanel}
        </section>
      </main>

      <UserProfileModal open={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </AppPageShell>
  )
}
