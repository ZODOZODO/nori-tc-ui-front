import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleUserRound, Loader2, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { authApi } from '@/features/auth/api/auth.api'
import { useMe } from '@/features/profile/hooks/useProfile'
import type { AppTopNavigationKey } from '../lib/app-navigation'
import { resolveVisibleAppNavigationItems } from '../lib/app-navigation'
import { clearCsrfCookie } from '../lib/session'

interface AppTopBarProps {
  currentMenu: AppTopNavigationKey
  onOpenProfile: () => void
  onAfterLogout?: () => void | Promise<void>
}

const LOGIN_ROUTE = '/login'
export const APP_TOP_BAR_OFFSET_CLASS = 'pt-[53px]'

/**
 * 주요 페이지들이 공유하는 상단 앱 헤더입니다.
 */
export function AppTopBar({ currentMenu, onOpenProfile, onAfterLogout }: AppTopBarProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isLogoutPending, setIsLogoutPending] = useState(false)
  const meQuery = useMe(true)
  const navigationItems = useMemo(
    () => resolveVisibleAppNavigationItems(meQuery.data?.permissionCodes),
    [meQuery.data?.permissionCodes],
  )

  const handleNavigateMenu = (route: string | null) => {
    if (!route) {
      return
    }

    const currentNavigationItem = navigationItems.find((item) => item.key === currentMenu)
    if (currentNavigationItem?.route === route) {
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
      console.warn('[AppTopBar] logout request failed, continuing with local cleanup', error)
    } finally {
      await onAfterLogout?.()
      queryClient.clear()
      clearCsrfCookie()
      navigate(LOGIN_ROUTE, { replace: true })
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 grid h-[53px] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 border-b border-[#E5ECE7] bg-white px-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-md bg-[#d95d39]">
          <span className="font-fraunces text-sm font-medium text-white">N</span>
        </div>
        <span className="font-fraunces text-lg text-[#2D2D2D]">Nori-TC</span>
      </div>

      <div className="flex min-w-0 items-center justify-center overflow-hidden">
        <nav className="flex min-w-0 items-center justify-center gap-6 whitespace-nowrap">
          {navigationItems.map((menuItem) => {
            const isCurrentMenu = menuItem.key === currentMenu

            return (
              <button
                key={menuItem.key}
                type="button"
                onClick={() => handleNavigateMenu(menuItem.route)}
                className={`group relative inline-flex h-[38px] items-center px-2 text-[14px] font-medium tracking-[0.01em] transition-colors ${
                  isCurrentMenu ? 'text-[#173f31]' : 'text-[#6A7971] hover:text-[#2B4A3F]'
                }`}
              >
                <span>{menuItem.label}</span>
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

      <div className="flex items-center justify-end gap-2">
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
          onClick={onOpenProfile}
          aria-label="사용자 프로필 열기"
          disabled={isLogoutPending}
        >
          <CircleUserRound className="size-[18px]" />
        </Button>
      </div>
    </header>
  )
}
