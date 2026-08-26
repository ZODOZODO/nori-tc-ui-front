import { useMemo } from 'react'
import { ShieldCheck, UserRound } from 'lucide-react'
import { GroupAdminPanel } from '@/features/group/components/GroupAdminPanel'
import { UserAdminPanel } from '@/features/user/components/UserAdminPanel'
import { useI18n } from '@/i18n/i18n-context'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { AppPageHeading } from '@/shared/layout/AppPageHeading'
import { cn } from '@/lib/utils'
import { useUserManagementUiStore } from '../stores/user-management-ui.store'
import type { UserManagementMode } from '../types/user-management.types'

const renderPanel = (mode: UserManagementMode) => {
  switch (mode) {
    case 'user':
      return <UserAdminPanel />
    case 'group':
      return <GroupAdminPanel />
  }
}

/**
 * `/user` 라우트의 통합 페이지입니다. 인증·USER_READ 권한 검사는 라우트 가드
 * (RequireAuth / RequirePermission)가 담당하며, 페이지 상단 카드에서 User / Group 모드를 전환합니다.
 */
export function UserManagementPage() {
  const { t } = useI18n()
  const mode = useUserManagementUiStore((state) => state.mode)
  const setMode = useUserManagementUiStore((state) => state.setMode)

  const activePanel = useMemo(() => renderPanel(mode), [mode])
  const modes: Array<{
    key: UserManagementMode
    label: string
    description: string
    icon: typeof UserRound
    testId: string
  }> = [
    {
      key: 'user',
      label: t('userManagement.mode.user'),
      description: t('userManagement.mode.userHint'),
      icon: UserRound,
      testId: 'user-management-sidebar-user',
    },
    {
      key: 'group',
      label: t('userManagement.mode.group'),
      description: t('userManagement.mode.groupHint'),
      icon: ShieldCheck,
      testId: 'user-management-sidebar-group',
    },
  ]

  return (
    <AppShellPage>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <AppPageHeading
          name={t('userManagement.page.title')}
          description={t('userManagement.page.description')}
          className="shrink-0"
        />

        <nav
          className="grid shrink-0 gap-2 sm:grid-cols-2"
          aria-label={t('userManagement.mode.ariaLabel')}
        >
          {modes.map((item) => {
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
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </button>
            )
          })}
        </nav>

        <section className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-background/40">
          {activePanel}
        </section>
      </main>
    </AppShellPage>
  )
}
