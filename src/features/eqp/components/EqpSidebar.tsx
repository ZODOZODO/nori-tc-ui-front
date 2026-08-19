import { memo, useDeferredValue, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { SidebarResizeHandle } from '@/components/ui/sidebar-resize-handle'
import { useI18n } from '@/i18n/i18n-context'
import {
  LNB_FOCUS_RING,
  lnbLeafClass,
  lnbLeafDotClass,
  lnbSubLinkClass,
} from '@/shared/layout/lnb-sidebar'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { EqpInfo, GatewayShardLease, ProtocolType } from '../types/eqp.types'
import { groupEqpItems } from '../utils/eqp-group.util'

interface EqpSidebarProps {
  /** 현재 라우트 스코프. 이 스코프의 하위 트리만 그린다(1단계 Business/Gateway 는 전역 LNB 소관). */
  scope: 'business' | 'gateway'
  eqpItems: EqpInfo[]
  /** gateway 그룹 분류 기준이 되는 shard lease 점유 현황 (조회 전이면 undefined) */
  shardLeases: GatewayShardLease[] | undefined
  selectedEqpId: string | null
  selectedBusinessGroupIndex: number | null
  selectedGroupIndex: number | null
  sidebarOpen: boolean
  sidebarWidth: number
  isLoading: boolean
  errorMessage: string | null
  onSelectEqp: (eqpId: string) => void
  onSelectGatewayGroup: (groupIndex: number) => void
  onSelectBusinessGroup: (groupIndex: number) => void
  onOpenEqpInfoUpdate: (eqpId: string) => void
  onOpenEqpModelBinding: (eqpId: string) => void
  onOpenEqpDelete: (eqpId: string) => void
  onOpenEqpCreate: (interfaceType: ProtocolType) => void
  onToggleSidebar: () => void
  onResizeSidebar: (deltaX: number) => void
}

/**
 * 설비 페이지의 in-page 2차 내비입니다 — 현재 라우트 스코프의 하위 트리만 담당합니다.
 *
 * 1단계였던 Business / Gateway 아코디언 헤더는 전역 LNB 의 menu-label 로 승격돼 여기서 사라졌다
 * (`/eqp/business` · `/eqp/gateway`). 남은 것은 그 스코프 안의 그룹·설비 노드, 검색, 우클릭 CRUD 다.
 * 시각 클래스는 `@/shared/layout/lnb-sidebar` 공용 헬퍼(eqp/model 공유).
 */
export const EqpSidebar = memo(function EqpSidebar({
  scope,
  eqpItems,
  shardLeases,
  selectedEqpId,
  selectedBusinessGroupIndex,
  selectedGroupIndex,
  sidebarOpen,
  sidebarWidth,
  isLoading,
  errorMessage,
  onSelectEqp,
  onSelectGatewayGroup,
  onSelectBusinessGroup,
  onOpenEqpInfoUpdate,
  onOpenEqpModelBinding,
  onOpenEqpDelete,
  onOpenEqpCreate,
  onToggleSidebar,
  onResizeSidebar,
}: EqpSidebarProps) {
  const { t } = useI18n()
  const [searchKeyword, setSearchKeyword] = useState('')
  // 입력 자체는 즉시 반영, 필터링은 deferred 로 — 큰 목록에서 입력 지연 완화.
  const deferredSearchKeyword = useDeferredValue(searchKeyword)

  const filteredEqpItems = useMemo(() => {
    const normalizedKeyword = deferredSearchKeyword.trim().toLowerCase()

    if (!normalizedKeyword) {
      return eqpItems
    }

    return eqpItems.filter((eqp) => eqp.eqpId.toLowerCase().includes(normalizedKeyword))
  }, [eqpItems, deferredSearchKeyword])

  /**
   * 검색 필터 후 groupEqpItems 유틸로 그룹화합니다.
   * 검색 결과 기준으로 그룹이 재계산되며, gateway 그룹은 shard lease 기준입니다.
   */
  const { gatewayGroups, businessGroups } = useMemo(
    () => groupEqpItems(filteredEqpItems, shardLeases),
    [filteredEqpItems, shardLeases],
  )

  // gateway_app 별 하위 eqp 노드 펼침/접힘. gateway_app 헤더 클릭으로 토글.
  // 초기값: 선택된 gateway 그룹 + 선택된 eqp 가 속한 그룹은 펼쳐 보여준다.
  const [expandedGatewayGroups, setExpandedGatewayGroups] = useState<Set<number>>(() => {
    const initial = new Set<number>()
    if (selectedGroupIndex !== null) {
      initial.add(selectedGroupIndex)
    }
    if (selectedEqpId) {
      const owner = gatewayGroups.find((group) =>
        group.items.some((eqp) => eqp.eqpId === selectedEqpId),
      )
      if (owner) {
        initial.add(owner.appIndex)
      }
    }
    return initial
  })
  // 검색 중에는 결과가 접혀 안 보이는 걸 막기 위해 모든 그룹을 강제로 펼친다(파생값, effect 미사용).
  const hasSearch = deferredSearchKeyword.trim().length > 0

  const toggleGatewayGroup = (appIndex: number) => {
    onSelectGatewayGroup(appIndex)
    setExpandedGatewayGroups((prev) => {
      const next = new Set(prev)
      if (next.has(appIndex)) {
        next.delete(appIndex)
      } else {
        next.add(appIndex)
      }
      return next
    })
  }

  const renderEqpNode = (eqp: EqpInfo, key: string) => {
    const isSelected = selectedEqpId === eqp.eqpId

    return (
      <ContextMenu key={key}>
        <ContextMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onSelectEqp(eqp.eqpId)}
            className={lnbLeafClass(isSelected)}
          >
            <span className={lnbLeafDotClass(isSelected)} />
            <span className="truncate">{eqp.eqpId}</span>
          </Button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuLabel>{eqp.eqpId}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onOpenEqpInfoUpdate(eqp.eqpId)}>
            Eqp Info Update
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onOpenEqpModelBinding(eqp.eqpId)}>
            Model Info Update
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" onSelect={() => onOpenEqpDelete(eqp.eqpId)}>
            Eqp Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  if (!sidebarOpen) {
    return (
      <aside
        className="flex flex-col self-stretch border-r border-border bg-card"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="flex h-13 items-center justify-center border-b border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={onToggleSidebar}
            className={cn(
              'flex size-8 items-center justify-center rounded-md border border-border p-0 text-muted-foreground hover:bg-muted',
              LNB_FOCUS_RING,
            )}
            aria-label={t('eqp.sidebar.expand')}
          >
            <ChevronRight className="size-4" />
          </Button>
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
          <div className="flex h-13 items-center justify-between border-b border-border px-3">
            <span className="truncate text-sm font-semibold text-foreground">
              {t('eqp.sidebar.title')}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={onToggleSidebar}
              className={cn(
                'flex size-8 items-center justify-center rounded-md border border-border p-0 text-muted-foreground hover:bg-muted',
                LNB_FOCUS_RING,
              )}
              aria-label={t('eqp.sidebar.collapse')}
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          <div className="px-3 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder={t('eqp.sidebar.searchPlaceholder')}
                className="h-9 bg-muted pl-8 text-xs"
              />
            </div>
          </div>

          {scope === 'business' ? (
            <nav
              className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3"
              data-testid="eqp-sidebar-business-tree"
            >
              {businessGroups.length === 0 ? (
                <p className="py-1 pl-8 text-[11px] text-muted-foreground">
                  {t('eqp.sidebar.noBusinessGroups')}
                </p>
              ) : (
                businessGroups.map((group) => (
                  <Button
                    key={group.appName}
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectBusinessGroup(group.appIndex)}
                    className={lnbSubLinkClass(selectedBusinessGroupIndex === group.appIndex)}
                  >
                    {group.appName}
                  </Button>
                ))
              )}

              {isLoading ? (
                <p className="px-3 pt-1 text-xs text-muted-foreground">{t('eqp.sidebar.loading')}</p>
              ) : null}
              {errorMessage ? <p className="px-3 pt-1 text-xs text-danger">{errorMessage}</p> : null}
            </nav>
          ) : (
            /* Gateway 스코프 — Eqp Create 우클릭 메뉴는 승격된 헤더 대신 트리 컨테이너가 받는다. */
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <nav
                  className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3"
                  data-testid="eqp-sidebar-gateway-tree"
                >
                  {gatewayGroups.length === 0 ? (
                    <p className="py-1 pl-8 text-[11px] text-muted-foreground">
                      {t('eqp.sidebar.noGatewayGroups')}
                    </p>
                  ) : (
                    gatewayGroups
                      // 검색 중에는 결과가 없는 그룹을 숨겨 검색 노이즈를 줄인다 (빈 그룹은 평시에만 노출).
                      .filter((group) => !hasSearch || group.items.length > 0)
                      .map((group) => (
                        <div key={group.appName} className="flex flex-col gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => toggleGatewayGroup(group.appIndex)}
                            className={cn(
                              lnbSubLinkClass(selectedGroupIndex === group.appIndex),
                              'flex items-center gap-1.5',
                            )}
                          >
                            <span className="truncate">{group.appName}</span>
                            {group.isUnleased ? (
                              <Badge variant="warning" title={t('eqp.gateway.unleasedTitle')}>
                                {t('eqp.gateway.unleasedBadge')}
                              </Badge>
                            ) : null}
                          </Button>
                          {expandedGatewayGroups.has(group.appIndex) || hasSearch
                            ? group.items.map((eqp) =>
                                renderEqpNode(eqp, `${group.appIndex}-${eqp.eqpId}`),
                              )
                            : null}
                        </div>
                      ))
                  )}

                  {isLoading ? (
                    <p className="px-3 pt-1 text-xs text-muted-foreground">
                      {t('eqp.sidebar.loading')}
                    </p>
                  ) : null}
                  {errorMessage ? (
                    <p className="px-3 pt-1 text-xs text-danger">{errorMessage}</p>
                  ) : null}
                </nav>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52">
                <ContextMenuLabel>Gateway</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => onOpenEqpCreate('SECS')}>
                  SECS Eqp Create
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onOpenEqpCreate('SOCKET')}>
                  Socket Eqp Create
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onOpenEqpCreate('PLC')}>
                  PLC Eqp Create
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )}
        </div>

        <SidebarResizeHandle onDrag={onResizeSidebar} />
      </div>
    </aside>
  )
})
