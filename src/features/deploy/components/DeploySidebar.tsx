import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarResizeHandle } from '@/components/ui/sidebar-resize-handle'
import { useI18n } from '@/i18n/i18n-context'
import { cn } from '@/lib/utils'
import type { DeployMode } from '../types/deploy.types'

interface DeploySidebarProps {
  mode: DeployMode
  onChangeMode: (mode: DeployMode) => void
  sidebarOpen: boolean
  sidebarWidth: number
  onToggleSidebar: () => void
  onResizeSidebar: (deltaX: number) => void
}

const SIDEBAR_ITEMS: ReadonlyArray<{ mode: DeployMode; labelKey: string; testId: string }> = [
  { mode: 'register', labelKey: 'deploy.sidebar.register', testId: 'deploy-sidebar-register' },
  { mode: 'deploy', labelKey: 'deploy.sidebar.deploy', testId: 'deploy-sidebar-deploy' },
  { mode: 'history', labelKey: 'deploy.sidebar.history', testId: 'deploy-sidebar-history' },
]

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * nori-client 리뉴얼 LNB 시각 패턴(flat nav / 아이콘 없음 / active 좌측 2px 액센트 + 코랄 틴트 /
 * hover 전환)을 입힌 Deploy 3-mode 전환 사이드바입니다. 자식 트리가 없어 아코디언은 두지 않습니다.
 * R4.2(접기 토글 + 폭 드래그 리사이즈)는 dlq/user 와 동일하게 shared-layout store +
 * SidebarResizeHandle 인프라로 흡수합니다. 색은 nori-client 의 slate/blue 가 아닌 ui-front
 * coral/neutral 토큰. 모드 전환 동작·라우팅 불변(R4.1).
 */
export function DeploySidebar({
  mode,
  onChangeMode,
  sidebarOpen,
  sidebarWidth,
  onToggleSidebar,
  onResizeSidebar,
}: DeploySidebarProps) {
  const { t } = useI18n()

  if (!sidebarOpen) {
    return (
      <aside
        className="flex flex-col self-stretch border-r border-border bg-card"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="flex h-[52px] items-center justify-center border-b border-border">
          <button
            type="button"
            onClick={onToggleSidebar}
            className={cn(
              'flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted',
              FOCUS_RING,
            )}
            aria-label={t('deploy.sidebar.expand')}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="flex flex-col self-stretch border-r border-border bg-card"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[52px] items-center justify-between border-b border-border px-3">
            <span className="truncate text-sm font-semibold text-foreground">
              {t('deploy.sidebar.title')}
            </span>
            <button
              type="button"
              onClick={onToggleSidebar}
              className={cn(
                'flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted',
                FOCUS_RING,
              )}
              aria-label={t('deploy.sidebar.collapse')}
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
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
        </div>

        <SidebarResizeHandle onDrag={onResizeSidebar} />
      </div>
    </aside>
  )
}
