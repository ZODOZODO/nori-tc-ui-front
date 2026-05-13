import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { useMe } from '@/features/profile/hooks/useProfile'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { DLQ_READ_PERMISSION, hasPermission } from '@/shared/lib/permission'
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
  const meQuery = useMe(true)
  const mode = useDlqUiStore((state) => state.mode)
  const setMode = useDlqUiStore((state) => state.setMode)
  const isProfileModalOpen = useDlqUiStore((state) => state.isProfileModalOpen)
  const setProfileModalOpen = useDlqUiStore((state) => state.setProfileModalOpen)

  const activePanel = useMemo(() => renderPanel(mode), [mode])

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6FBF8] text-sm text-[#4B5A52]">
        사용자 정보를 확인하는 중입니다.
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
        <DlqSidebar mode={mode} onChangeMode={setMode} />

        <section className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {activePanel}
        </section>
      </main>

      <UserProfileModal open={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </AppPageShell>
  )
}
