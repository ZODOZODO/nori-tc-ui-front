import { useState, type ReactNode } from 'react'
import { authApi } from '@/features/auth/api/auth.api'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { AppPageShell } from './AppPageShell'

interface AppShellPageProps {
  children: ReactNode
  /** 로그아웃 직전 페이지 정리(스토어 초기화 등). 지정하지 않으면 서버 로그아웃만 수행한다. */
  onAfterLogout?: () => void | Promise<void>
  className?: string
}

/**
 * 앱 셸 + 프로필 모달까지 묶은 페이지 래퍼입니다(SPEC R7).
 *
 * <p>모든 라우트 페이지가 같은 `profileOpen` 상태와 `UserProfileModal` 배선을 반복하고 있었다
 * (5 개 store 에 `isProfileModalOpen` 이 분산). 신규 페이지는 이 래퍼만 쓰고 본문에 집중한다.</p>
 *
 * <p>서버 로그아웃 실패는 삼킨다 — 세션이 이미 죽어 401 이 나는 경우가 정상 경로이고, 그때도
 * 로컬 정리와 `/login` 이동은 반드시 일어나야 한다(정리 자체는 AppTopBar 의 finally 가 수행).</p>
 */
export function AppShellPage({ children, onAfterLogout, className }: AppShellPageProps) {
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <AppPageShell
      onOpenProfile={() => setProfileOpen(true)}
      onAfterLogout={async () => {
        await onAfterLogout?.()
        try {
          await authApi.logout()
        } catch (error) {
          console.warn('[AppShellPage] logout request failed, continuing with local cleanup', error)
        }
      }}
      className={className}
    >
      {children}
      <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </AppPageShell>
  )
}
