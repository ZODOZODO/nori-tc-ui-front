import { useMemo } from 'react'
import { GroupAdminPanel } from '@/features/group/components/GroupAdminPanel'
import { UserAdminPanel } from '@/features/user/components/UserAdminPanel'
import { useI18n } from '@/i18n/i18n-context'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { AppPageHeading } from '@/shared/layout/AppPageHeading'
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

/** 제목 아래 설명문의 i18n 키. 구 패널 본문에 있던 같은 문구를 제목 블록으로 올린 것이다. */
const DESCRIPTION_KEY_BY_MODE: Record<UserManagementMode, string> = {
  user: 'user.description',
  group: 'group.description',
}

/**
 * `/user/*` 라우트의 통합 페이지입니다. 인증·USER_READ 권한 검사는 라우트 가드
 * (RequireAuth / RequirePermission)가 담당한다.
 *
 * User / Group 전환은 전역 LNB 가 맡는다 — 같은 항목을 in-page 사이드바로 한 번 더 보여주지 않는다.
 */
export function UserManagementPage({ mode }: UserManagementPageProps) {
  const { t } = useI18n()
  const activePanel = useMemo(() => renderPanel(mode), [mode])

  return (
    <AppShellPage>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-5 lg:p-6">
        <AppPageHeading description={t(DESCRIPTION_KEY_BY_MODE[mode])} />
        {/* 세로 스크롤을 이 main 이 갖는다 — 패널이 자체 스크롤 컨테이너를 두지 않으므로
            여기서 빼면 셸의 overflow-hidden 에 걸려 목록이 잘린다(실측 376~536px). */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden">
          {activePanel}
        </main>
      </section>
    </AppShellPage>
  )
}
