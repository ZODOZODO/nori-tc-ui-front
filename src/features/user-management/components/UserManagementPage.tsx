import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { GroupAdminPanel } from '@/features/group/components/GroupAdminPanel'
import { useMe } from '@/features/profile/hooks/useProfile'
import { UserAdminPanel } from '@/features/user/components/UserAdminPanel'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { hasPermission, USER_READ_PERMISSION } from '@/shared/lib/permission'
import { useUserManagementUiStore } from '../stores/user-management-ui.store'
import type { UserManagementMode } from '../types/user-management.types'
import { UserManagementSidebar } from './UserManagementSidebar'

const FORBIDDEN_FALLBACK_ROUTE = '/login'

const renderPanel = (mode: UserManagementMode) => {
  switch (mode) {
    case 'user':
      return <UserAdminPanel />
    case 'group':
      return <GroupAdminPanel />
  }
}

/**
 * `/user` 라우트의 통합 페이지입니다. USER_READ 권한 없는 사용자는 /login 으로 리다이렉트됩니다.
 * 좌측 사이드바에서 User / Group 모드를 전환합니다.
 */
export function UserManagementPage() {
  const meQuery = useMe(true)
  const mode = useUserManagementUiStore((state) => state.mode)
  const setMode = useUserManagementUiStore((state) => state.setMode)
  const isProfileModalOpen = useUserManagementUiStore((state) => state.isProfileModalOpen)
  const setProfileModalOpen = useUserManagementUiStore((state) => state.setProfileModalOpen)

  const activePanel = useMemo(() => renderPanel(mode), [mode])

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6FBF8] text-sm text-[#4B5A52]">
        사용자 정보를 확인하는 중입니다.
      </div>
    )
  }

  if (!hasPermission(meQuery.data?.permissionCodes, USER_READ_PERMISSION)) {
    return <Navigate to={FORBIDDEN_FALLBACK_ROUTE} replace />
  }

  return (
    <AppPageShell
      currentMenu="user"
      onOpenProfile={() => setProfileModalOpen(true)}
      onAfterLogout={() => setProfileModalOpen(false)}
    >
      <main className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden">
        <UserManagementSidebar mode={mode} onChangeMode={setMode} />

        <section className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          {activePanel}
        </section>
      </main>

      <UserProfileModal open={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </AppPageShell>
  )
}
