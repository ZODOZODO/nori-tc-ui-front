import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { GroupAdminPanel } from '@/features/group/components/GroupAdminPanel'
import { UserAdminPanel } from '@/features/user/components/UserAdminPanel'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { clampSidebarWidth } from '@/shared/layout/sidebar-layout'
import { useSharedLayoutStore } from '@/shared/stores/shared-layout.store'
import type { UserManagementMode } from '../types/user-management.types'
import { UserManagementSidebar } from './UserManagementSidebar'

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
 * `/user/*` 라우트의 통합 페이지입니다. 인증·USER_READ 권한 검사는 라우트 가드
 * (RequireAuth / RequirePermission)가 담당한다. 모드는 URL 세그먼트가 정하며, 모드 전환은 navigate 다.
 */
export function UserManagementPage({ mode }: UserManagementPageProps) {
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
    </AppShellPage>
  )
}
