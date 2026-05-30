import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/i18n-context'
import { cn } from '@/lib/utils'
import type { UserManagementMode } from '../types/user-management.types'

interface UserManagementSidebarProps {
  mode: UserManagementMode
  onChangeMode: (mode: UserManagementMode) => void
}

const SIDEBAR_ITEMS: Array<{ mode: UserManagementMode; label: string; testId: string }> = [
  { mode: 'user', label: 'User', testId: 'user-management-sidebar-user' },
  { mode: 'group', label: 'Group', testId: 'user-management-sidebar-group' },
]

/**
 * nori-client 리뉴얼 LNB 시각 패턴(flat nav / active 좌측 액센트 + 코랄 틴트 / hover 전환)을 입힌
 * User / Group 2-모드 전환 사이드바입니다. 자식 트리가 없어 아코디언은 두지 않습니다.
 * 색은 nori-client 의 slate/blue 가 아닌 ui-front coral/neutral 토큰. 모드 전환 동작·testId 불변(R4.1).
 */
export function UserManagementSidebar({ mode, onChangeMode }: UserManagementSidebarProps) {
  const { t } = useI18n()

  return (
    <aside className="flex w-[240px] shrink-0 flex-col self-stretch border-r border-border bg-card">
      <div className="flex h-[52px] items-center border-b border-border px-3">
        <span className="truncate text-sm font-semibold text-foreground">
          {t('userMgmt.sidebar.title')}
        </span>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 py-3">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = item.mode === mode

          return (
            <Button
              key={item.mode}
              type="button"
              variant="ghost"
              data-testid={item.testId}
              onClick={() => onChangeMode(item.mode)}
              className={cn(
                'h-9 justify-start rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'border-l-2 border-brand-primary bg-brand-primary/10 pl-[14px] font-semibold text-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary'
                  : 'pl-4 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
