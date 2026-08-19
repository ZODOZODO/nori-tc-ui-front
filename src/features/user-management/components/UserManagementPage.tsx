import { useMemo } from 'react'
import { GroupAdminPanel } from '@/features/group/components/GroupAdminPanel'
import { UserAdminPanel } from '@/features/user/components/UserAdminPanel'
import { AppShellPage } from '@/shared/components/AppShellPage'
import type { UserManagementMode } from '../types/user-management.types'

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
 * (RequireAuth / RequirePermission)가 담당한다.
 *
 * User / Group 전환은 전역 LNB 가 맡는다 — 같은 항목을 in-page 사이드바로 한 번 더 보여주지 않는다.
 */
export function UserManagementPage({ mode }: UserManagementPageProps) {
  const activePanel = useMemo(() => renderPanel(mode), [mode])

  return (
    <AppShellPage>
      <main className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        {activePanel}
      </main>
    </AppShellPage>
  )
}
