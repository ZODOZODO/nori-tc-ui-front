import { useEffect, useMemo } from 'react'
import { ClipboardList, History, Rocket } from 'lucide-react'
import { useI18n } from '@/i18n/i18n-context'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { AppPageHeading } from '@/shared/layout/AppPageHeading'
import { cn } from '@/lib/utils'
import { DeployHistoryPanel } from './DeployHistoryPanel'
import { DeployMonitorPanel } from './DeployMonitorPanel'
import { DeployRegisterPanel } from './DeployRegisterPanel'
import { clearDeployUiSessionState, useDeployUiStore } from '../stores/deploy-ui.store'
import type { DeployMode } from '../types/deploy.types'

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

/** 단계 카드의 라벨·설명 i18n 키. 설명문은 구 라우트별 설명을 그대로 승계한다. */
const MODE_CARDS: ReadonlyArray<{
  key: DeployMode
  labelKey: string
  descriptionKey: string
  icon: typeof ClipboardList
  testId: string
}> = [
  {
    key: 'register',
    labelKey: 'deploy.mode.register',
    descriptionKey: 'deploy.page.description.register',
    icon: ClipboardList,
    testId: 'deploy-mode-register',
  },
  {
    key: 'deploy',
    labelKey: 'deploy.mode.deploy',
    descriptionKey: 'deploy.page.description.deploy',
    icon: Rocket,
    testId: 'deploy-mode-deploy',
  },
  {
    key: 'history',
    labelKey: 'deploy.mode.history',
    descriptionKey: 'deploy.page.description.history',
    icon: History,
    testId: 'deploy-mode-history',
  },
]

/**
 * `/deploy` 라우트의 통합 페이지입니다. 인증·DEPLOY_READ 권한 검사는 라우트 가드
 * (RequireAuth / RequirePermission)가 담당한다.
 *
 * <p>등록 → 배포 → 이력은 서로 다른 화면이 아니라 한 배포 작업의 단계다 — 세 단계가 같은
 * `deploy-ui.store` 하나를 공유하므로(선택 설비 / activeDeployKey / localHistory) 라우트를
 * 쪼개지 않고 페이지 안에서 전환한다.</p>
 */
export function DeployPage() {
  const { t } = useI18n()
  const mode = useDeployUiStore((state) => state.mode)
  const setMode = useDeployUiStore((state) => state.setMode)
  const activePanel = useMemo(() => renderPanel(mode), [mode])

  useEffect(() => {
    return () => {
      // deploy 구역을 완전히 벗어날 때만 세션 상태를 지운다. StrictMode 의 개발 모드
      // 이중 마운트에서도 cleanup 이 즉시 한 번 도는데, 그때 경로는 아직 `/deploy` 라 살아남는다.
      if (!window.location.pathname.startsWith('/deploy')) {
        clearDeployUiSessionState()
      }
    }
  }, [])

  return (
    <AppShellPage onAfterLogout={clearDeployUiSessionState}>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-5 lg:p-6">
        <AppPageHeading description={t('deploy.page.description')} />

        <nav
          className="grid shrink-0 gap-2 sm:grid-cols-3"
          aria-label={t('deploy.mode.ariaLabel')}
        >
          {MODE_CARDS.map((item) => {
            const Icon = item.icon
            const isActive = item.key === mode
            return (
              <button
                key={item.key}
                type="button"
                data-testid={item.testId}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setMode(item.key)}
                className={cn(
                  'group flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-soft-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'border-brand-primary/45 bg-brand-primary/8 text-foreground'
                    : 'border-border bg-card text-foreground hover:border-foreground/20 hover:bg-muted/35',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    isActive
                      ? 'bg-brand-primary text-white'
                      : 'bg-muted text-muted-foreground group-hover:text-foreground',
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t(item.labelKey)}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {t(item.descriptionKey)}
                  </span>
                </span>
              </button>
            )
          })}
        </nav>

        {/* 세로 스크롤을 이 main 이 갖는다 — 패널이 자체 스크롤 컨테이너를 두지 않으므로
            여기서 빼면 셸의 overflow-hidden 에 걸려 내용이 잘린다. */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden">
          <div className="flex min-h-full min-w-0 max-w-full flex-1">{activePanel}</div>
        </main>
      </section>
    </AppShellPage>
  )
}
