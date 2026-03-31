import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleUserRound, Loader2, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { authApi } from '@/features/auth/api/auth.api'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { DeployHistoryPanel } from './DeployHistoryPanel'
import { DeployMonitorPanel } from './DeployMonitorPanel'
import { DeployRegisterPanel } from './DeployRegisterPanel'
import { DeploySidebar } from './DeploySidebar'
import { useDeployUiStore } from '../stores/deploy-ui.store'
import type { DeployMode } from '../types/deploy.types'

const LOGIN_ROUTE = '/login'
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'

const TOP_NAVIGATION_ITEMS = [
  { name: 'Eqp', route: '/eqp' },
  { name: 'Model', route: '/model' },
  { name: 'Deploy', route: '/deploy' },
  { name: 'Dlq', route: null },
  { name: 'User', route: null },
] as const

const clearCsrfCookie = () => {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${CSRF_COOKIE_NAME}=; Max-Age=0; path=/`
}

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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isLogoutPending, setIsLogoutPending] = useState(false)

  const mode = useDeployUiStore((state) => state.mode)
  const isProfileModalOpen = useDeployUiStore((state) => state.isProfileModalOpen)
  const setMode = useDeployUiStore((state) => state.setMode)
  const setProfileModalOpen = useDeployUiStore((state) => state.setProfileModalOpen)

  const activePanel = useMemo(() => renderPanel(mode), [mode])

  const handleNavigateMenu = (route: string | null) => {
    if (!route || route === '/deploy') {
      return
    }

    navigate(route)
  }

  const handleLogout = async () => {
    if (isLogoutPending) {
      return
    }

    setIsLogoutPending(true)

    try {
      await authApi.logout()
    } catch (error) {
      console.warn('[DeployPage] logout request failed, continuing with local cleanup', error)
    } finally {
      setProfileModalOpen(false)
      queryClient.clear()
      clearCsrfCookie()
      navigate(LOGIN_ROUTE, { replace: true })
    }
  }

  return (
    <div className="flex min-h-screen min-w-0 w-full flex-col overflow-x-hidden bg-[#F7FAF8]">
      <header className="relative flex h-[52px] items-center justify-between bg-white px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-[#d95d39]">
            <span className="font-fraunces text-sm font-medium text-white">N</span>
          </div>
          <span className="font-fraunces text-lg text-[#2D2D2D]">Nori-TC</span>
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 hidden items-center justify-center md:flex"
          style={{ left: '164px', right: '164px' }}
        >
          <nav className="pointer-events-auto flex max-w-full items-center gap-6 overflow-hidden whitespace-nowrap">
            {TOP_NAVIGATION_ITEMS.map((menuItem) => {
              const isCurrentMenu = menuItem.name === 'Deploy'

              return (
                <button
                  key={menuItem.name}
                  type="button"
                  onClick={() => handleNavigateMenu(menuItem.route)}
                  className={`group relative inline-flex h-[38px] items-center px-2 text-[14px] font-medium tracking-[0.01em] transition-colors ${
                    isCurrentMenu
                      ? 'text-[#173f31]'
                      : 'text-[#6A7971] hover:text-[#2B4A3F]'
                  }`}
                >
                  <span>{menuItem.name}</span>
                  <span
                    className={`pointer-events-none absolute -bottom-px left-0 right-0 h-[2px] rounded-full transition-opacity ${
                      isCurrentMenu
                        ? 'bg-[#1C7F59] opacity-100'
                        : 'bg-[#1C7F59] opacity-0 group-hover:opacity-35'
                    }`}
                  />
                </button>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-[38px] rounded-full border-[#DCE5E0] px-3.5 text-sm font-medium text-[#4B5A52]"
            onClick={() => void handleLogout()}
            disabled={isLogoutPending}
            aria-label="로그아웃"
          >
            {isLogoutPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            로그아웃
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="size-[38px] rounded-full border border-[#DCE5E0] text-[#4B5A52]"
            onClick={() => setProfileModalOpen(true)}
            aria-label="사용자 프로필 열기"
            disabled={isLogoutPending}
          >
            <CircleUserRound className="size-[18px]" />
          </Button>
        </div>
      </header>

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
