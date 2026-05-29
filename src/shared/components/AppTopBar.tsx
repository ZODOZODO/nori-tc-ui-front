import { useMemo, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { CircleUserRound, Loader2, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/i18n-context'
import { LanguageToggle } from '@/i18n/LanguageToggle'
import { authApi } from '@/features/auth/api/auth.api'
import { dlqApi } from '@/features/dlq/api/dlq.api'
import { eqpApi } from '@/features/eqp/api/eqp.api'
import { eqpQueryKeys } from '@/features/eqp/lib/eqp-query-keys'
import { liveMapApi } from '@/features/live-map/api/live-map.api'
import { modelApi } from '@/features/model/api/model.api'
import { modelQueryKeys } from '@/features/model/lib/model-query-keys'
import { useMe } from '@/features/profile/hooks/useProfile'
import { userApi } from '@/features/user/api/user.api'
import { userQueryKeys } from '@/features/user/lib/user-query-keys'
import { USER_PAGE_SIZE } from '@/features/user/components/UserListTable'
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
 * 메뉴 hover 시 해당 페이지가 첫 mount 에서 자동 호출하는 query 를 미리 fetch.
 * queryKey / queryFn / staleTime 은 각 hook 정의와 정확히 일치해야 cache hit 발생.
 * deploy 는 mode/filter 분기로 정적 query 가 없어 제외.
 * user 의 listOffset 은 0 가정 — 사용자가 페이지를 넘긴 상태에서는 prefetch miss.
 */
const prefetchByMenuKey = (queryClient: QueryClient, key: AppTopNavigationKey): void => {
  switch (key) {
    case 'eqp':
      void queryClient.prefetchQuery({
        queryKey: eqpQueryKeys.list(),
        queryFn: () => eqpApi.getEqpList(0, 500),
        staleTime: 60_000,
      })
      return
    case 'model':
      void queryClient.prefetchQuery({
        queryKey: modelQueryKeys.list(),
        queryFn: () => modelApi.getModelList(0, 500),
        staleTime: 60_000,
      })
      return
    case 'dash':
      void queryClient.prefetchQuery({
        queryKey: ['live-map'],
        queryFn: () => liveMapApi.getLiveMap(),
        staleTime: 5_000,
      })
      return
    case 'dlq':
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'business'],
        queryFn: dlqApi.fetchBusinessDlq,
        staleTime: 30_000,
      })
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'gateway'],
        queryFn: dlqApi.fetchGatewayDlq,
        staleTime: 30_000,
      })
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'quarantine'],
        queryFn: dlqApi.fetchQuarantine,
        staleTime: 30_000,
      })
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'repair-task'],
        queryFn: dlqApi.fetchRepairTasks,
        staleTime: 30_000,
      })
      return
    case 'user':
      void queryClient.prefetchQuery({
        queryKey: userQueryKeys.list(0, USER_PAGE_SIZE),
        queryFn: () => userApi.getUserList(0, USER_PAGE_SIZE),
        staleTime: 30_000,
      })
      return
    case 'deploy':
      return
  }
}

/**
 * 주요 페이지들이 공유하는 상단 앱 헤더입니다.
 */
export function AppTopBar({ currentMenu, onOpenProfile, onAfterLogout }: AppTopBarProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useI18n()
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
    <header className="fixed inset-x-0 top-0 z-40 grid h-[53px] shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6 border-b border-border bg-white px-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-md bg-brand-primary">
          <span className="font-fraunces text-sm font-medium text-white">N</span>
        </div>
        <span className="font-fraunces text-lg text-foreground">Nori-TC</span>
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
                onMouseEnter={
                  isCurrentMenu ? undefined : () => prefetchByMenuKey(queryClient, menuItem.key)
                }
                onFocus={
                  isCurrentMenu ? undefined : () => prefetchByMenuKey(queryClient, menuItem.key)
                }
                className={`group relative inline-flex h-[38px] items-center px-2 text-[14px] font-medium tracking-[0.01em] transition-colors ${
                  isCurrentMenu ? 'text-foreground' : 'text-muted-foreground hover:text-accent-foreground'
                }`}
              >
                <span>{menuItem.label}</span>
                <span
                  className={`pointer-events-none absolute -bottom-px left-0 right-0 h-[2px] rounded-full transition-opacity ${
                    isCurrentMenu
                      ? 'bg-[var(--color-brand-accent)] opacity-100'
                      : 'bg-[var(--color-brand-accent)] opacity-0 group-hover:opacity-35'
                  }`}
                />
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center justify-end gap-2">
        <LanguageToggle />

        <Button
          type="button"
          variant="outline"
          className="h-[38px] rounded-full border-border px-3.5 text-sm font-medium text-muted-foreground"
          onClick={() => void handleLogout()}
          disabled={isLogoutPending}
          aria-label={t('topbar.logout')}
        >
          {isLogoutPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="size-4" aria-hidden="true" />
          )}
          {t('topbar.logout')}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="size-[38px] rounded-full border border-border text-muted-foreground"
          onClick={onOpenProfile}
          aria-label={t('topbar.openProfile')}
          disabled={isLogoutPending}
        >
          <CircleUserRound className="size-[18px]" />
        </Button>
      </div>
    </header>
  )
}
