import { useCallback, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { GroupAdminPanel } from '@/features/group/components/GroupAdminPanel'
import { useMe } from '@/features/profile/hooks/useProfile'
import { UserAdminPanel } from '@/features/user/components/UserAdminPanel'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { useI18n } from '@/i18n/i18n-context'
import { clampSidebarWidth } from '@/shared/layout/sidebar-layout'
import { hasPermission, USER_READ_PERMISSION } from '@/shared/lib/permission'
import { useSharedLayoutStore } from '@/shared/stores/shared-layout.store'
import type { UserManagementMode } from '../types/user-management.types'
import { UserManagementSidebar } from './UserManagementSidebar'

const FORBIDDEN_FALLBACK_ROUTE = '/login'

/** 모드 ↔ URL 세그먼트 — 유일하게 1:1 이 아닌 매핑이라 표로 고정한다. */
const MODE_SEGMENT: Readonly<Record<UserManagementMode, string>> = {
  user: 'users',
  group: 'groups',
}

interface UserManagementPageProps {
  /** 표시할 모드. 라우트가 정한다 — URL 이 단일 진실 원천이다. */
  mode: UserManagementMode
}

const renderPanel = (mode: UserManagementMode) => {
  switch (mode) {
    case 'user':
      return <UserAdminPanel />
    case 'group':
      return <GroupAdminPanel />
  }
}

/**
 * `/user/*` 라우트의 통합 페이지입니다. USER_READ 권한 없는 사용자는 /login 으로 리다이렉트됩니다.
 * 모드는 URL 세그먼트가 정하며, 모드 전환은 navigate 다.
 */
export function UserManagementPage({ mode }: UserManagementPageProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const meQuery = useMe(true)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
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
        {t('user.loading')}
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
        <UserManagementSidebar
          mode={mode}
          onChangeMode={(nextMode) => navigate(`/user/${MODE_SEGMENT[nextMode]}`)}
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
