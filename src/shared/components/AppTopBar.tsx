import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleUserRound, Loader2, LogOut, PanelLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar-context'
import { useI18n } from '@/i18n/i18n-context'
import { LanguageToggle } from '@/i18n/LanguageToggle'
import { clearDeployUiSessionState } from '@/features/deploy/stores/deploy-ui.store'
import { PageLocation } from '@/shared/layout/PageLocation'
import { resolveAppNavigationLocation } from '../lib/app-navigation'
import { clearPersistedQueryCache } from '../lib/query-persistence'
import { clearCsrfCookie } from '../lib/session'
import { ThemeToggle } from './ThemeToggle'
import { LineScopeSelector } from './LineScopeSelector'

interface AppTopBarProps {
  onOpenProfile: () => void
  onAfterLogout?: () => void | Promise<void>
}

const LOGIN_ROUTE = '/login'

/**
 * 주요 페이지들이 공유하는 얇은 상단 헤더입니다(SPEC R6).
 *
 * <p>1차 내비게이션은 좌측 LNB({@link AppLnbSidebar})가 담당하므로 이 헤더에는 중앙 nav 링크가 없다 —
 * 모바일 off-canvas 토글, 현재 위치 breadcrumb, 우측 유틸리티(라인 스코프 / 테마 / 언어 /
 * 로그아웃 / 프로필)만 둔다.</p>
 *
 * <p>breadcrumb 은 현재 경로에서 LNB 정의로 유도한다 — 페이지가 각자 적어 넣지 않으므로 모든 화면에
 * 같은 규칙으로 나타난다. LNB 에 없는 경로는 표시하지 않는다.</p>
 *
 * <p>헤더가 `fixed` 가 아니라 정상 흐름이므로 본문 상단에 오프셋 패딩을 덧대던 상수가 필요 없다 —
 * 셸이 LNB + 본문 2열 구조가 되면서 폐기했다.</p>
 */
export function AppTopBar({ onOpenProfile, onAfterLogout }: AppTopBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { t } = useI18n()
  const { isMobile, toggleSidebar } = useSidebar()
  const [isLogoutPending, setIsLogoutPending] = useState(false)
  const navigationLocation = resolveAppNavigationLocation(location.pathname)

  const handleLogout = async () => {
    if (isLogoutPending) {
      return
    }

    setIsLogoutPending(true)

    try {
      // 서버 로그아웃과 페이지별 정리는 AppShellPage 가 합성해 넘긴다 — 실패해도 로컬 정리는 진행한다.
      await onAfterLogout?.()
    } finally {
      queryClient.clear()
      // clear() 는 인메모리만 비운다 — localStorage 사본과 sessionStorage 는 별개로 지워야
      // 공유 PC 에서 다음 사용자가 이전 사용자의 업무 데이터를 복원해 보지 않는다(S09 E-1 / E-3).
      clearPersistedQueryCache()
      clearDeployUiSessionState()
      clearCsrfCookie()
      navigate(LOGIN_ROUTE, { replace: true })
    }
  }

  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-6 border-b border-border bg-card/95 px-5 backdrop-blur-sm lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {isMobile ? (
          <Button
            type="button"
            variant="ghost"
            className="size-9 shrink-0 rounded-md text-muted-foreground"
            onClick={toggleSidebar}
            aria-label={t('navigation.openMenu')}
          >
            <PanelLeft className="size-4.5" aria-hidden="true" />
          </Button>
        ) : null}
        {navigationLocation ? (
          <PageLocation
            subtitle={t(navigationLocation.group.labelKey)}
            name={t(navigationLocation.item.labelKey)}
            className="min-w-0"
          />
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <LineScopeSelector />
        <ThemeToggle />
        <LanguageToggle />

        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground has-[>svg]:px-3.5"
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
          className="size-9 rounded-lg border border-input text-muted-foreground"
          onClick={onOpenProfile}
          aria-label={t('topbar.openProfile')}
          disabled={isLogoutPending}
        >
          <CircleUserRound className="size-4.5" />
        </Button>
      </div>
    </header>
  )
}
