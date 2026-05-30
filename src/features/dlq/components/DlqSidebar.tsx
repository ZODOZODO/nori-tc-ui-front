import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/i18n-context'
import { cn } from '@/lib/utils'
import type { DlqMode } from '../types/dlq.types'

interface DlqSidebarProps {
  mode: DlqMode
  onChangeMode: (mode: DlqMode) => void
}

const SIDEBAR_ITEMS: ReadonlyArray<{ mode: DlqMode; labelKey: string; testId: string }> = [
  { mode: 'dashboard', labelKey: 'dlq.sidebar.dashboard', testId: 'dlq-sidebar-dashboard' },
  { mode: 'gateway', labelKey: 'dlq.sidebar.gateway', testId: 'dlq-sidebar-gateway' },
  { mode: 'business', labelKey: 'dlq.sidebar.business', testId: 'dlq-sidebar-business' },
  { mode: 'quarantine', labelKey: 'dlq.sidebar.quarantine', testId: 'dlq-sidebar-quarantine' },
  { mode: 'repair-task', labelKey: 'dlq.sidebar.repairTask', testId: 'dlq-sidebar-repair-task' },
]

/**
 * nori-client 리뉴얼 LNB 시각 패턴(flat nav / 아이콘 없음 / active 좌측 2px 액센트 + 코랄 틴트 /
 * hover 전환)을 입힌 DLQ 5-mode 전환 사이드바입니다. 자식 트리가 없어 아코디언은 두지 않습니다.
 * 색은 nori-client 의 slate/blue 가 아닌 ui-front coral/neutral 토큰. 모드 전환 동작·testId 불변(R4.1).
 */
export function DlqSidebar({ mode, onChangeMode }: DlqSidebarProps) {
  const { t } = useI18n()

  return (
    <aside className="flex w-[240px] shrink-0 flex-col self-stretch border-r border-border bg-card">
      <div className="flex h-[52px] items-center border-b border-border px-3">
        <span className="truncate text-sm font-semibold text-foreground">
          {t('dlq.sidebar.title')}
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
              {t(item.labelKey)}
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
