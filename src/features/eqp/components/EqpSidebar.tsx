import { memo, useDeferredValue, useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
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
import { useI18n } from '@/i18n/i18n-context'
import {
  lnbGroupClass,
  lnbLeafClass,
  lnbLeafDotClass,
  lnbSubLinkClass,
} from '@/shared/layout/lnb-sidebar'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type {
  BusinessAppAssignment,
  EqpInfo,
  GatewayShardLease,
  ProtocolType,
} from '../types/eqp.types'
import { groupEqpItems } from '../utils/eqp-group.util'

interface EqpSidebarProps {
  /** 현재 스코프. 상단 현황 카드가 정한다 — 이 스코프의 하위 트리만 그린다. */
  scope: 'business' | 'gateway'
  eqpItems: EqpInfo[]
  /** gateway 그룹 분류 기준이 되는 shard lease 점유 현황 (조회 전이면 undefined) */
  shardLeases: GatewayShardLease[] | undefined
  /** business 그룹 분류 기준이 되는 프로세스별 partition 할당 (조회 전이면 undefined) */
  businessAssignments: BusinessAppAssignment[] | undefined
  selectedEqpId: string | null
  selectedBusinessGroupIndex: number | null
  selectedGroupIndex: number | null
  isLoading: boolean
  errorMessage: string | null
  onSelectEqp: (eqpId: string) => void
  onSelectGatewayGroup: (groupIndex: number) => void
  onSelectBusinessGroup: (groupIndex: number) => void
  onOpenEqpInfoUpdate: (eqpId: string) => void
  onOpenEqpModelBinding: (eqpId: string) => void
  onOpenEqpDelete: (eqpId: string) => void
  onOpenEqpCreate: (interfaceType: ProtocolType) => void
}

/**
 * 설비 페이지의 좌측 목록 컬럼입니다 — 현재 스코프의 그룹·설비 노드, 검색, 우클릭 CRUD 를 담습니다.
 *
 * <p>Business / Gateway 1단계는 페이지 상단 현황 카드가 고르고, 고른 결과를 이 컬럼이 편다.
 * 접히지 않는 고정폭 컬럼이라 토글·폭 드래그가 없다 — 오른쪽 상세와 한 카드 안에서 짝을 이룬다.</p>
 *
 * <p>시각 클래스는 `@/shared/layout/lnb-sidebar` 공용 헬퍼(eqp/model 공유).</p>
 */
export const EqpSidebar = memo(function EqpSidebar({
  scope,
  eqpItems,
  shardLeases,
  businessAssignments,
  selectedEqpId,
  selectedBusinessGroupIndex,
  selectedGroupIndex,
  isLoading,
  errorMessage,
  onSelectEqp,
  onSelectGatewayGroup,
  onSelectBusinessGroup,
  onOpenEqpInfoUpdate,
  onOpenEqpModelBinding,
  onOpenEqpDelete,
  onOpenEqpCreate,
}: EqpSidebarProps) {
  const { t } = useI18n()
  const [searchKeyword, setSearchKeyword] = useState('')
  // 입력 자체는 즉시 반영, 필터링은 deferred 로 — 큰 목록에서 입력 지연 완화.
  const deferredSearchKeyword = useDeferredValue(searchKeyword)

  const normalizedKeyword = deferredSearchKeyword.trim().toLowerCase()
  const hasSearch = normalizedKeyword.length > 0

  const { gatewayGroups: allGatewayGroups, businessGroups: allBusinessGroups } = useMemo(
    () => groupEqpItems(eqpItems, shardLeases, businessAssignments),
    [businessAssignments, eqpItems, shardLeases],
  )

  /**
   * 검색은 그 스코프의 트리가 실제로 담고 있는 것만 거릅니다.
   *
   * <p>gateway 트리는 설비 리프를 가지므로 설비 ID 로 거르고, business 트리는 business_app 노드만
   * 가지므로 그룹 이름으로 거른다. 두 스코프에서 같은 축으로 거르면 — business 에서 설비 ID 로
   * 거르면 — 화면에 없는 것을 검색해 그룹이 소리 없이 사라진다.</p>
   */
  const gatewayGroups = useMemo(() => {
    if (!hasSearch) {
      return allGatewayGroups
    }
    return allGatewayGroups.map((group) => ({
      ...group,
      items: group.items.filter((eqp) => eqp.eqpId.toLowerCase().includes(normalizedKeyword)),
    }))
  }, [allGatewayGroups, hasSearch, normalizedKeyword])

  const businessGroups = useMemo(() => {
    if (!hasSearch) {
      return allBusinessGroups
    }
    return allBusinessGroups.filter((group) =>
      group.appName.toLowerCase().includes(normalizedKeyword),
    )
  }, [allBusinessGroups, hasSearch, normalizedKeyword])

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

  const groupCount = scope === 'business' ? businessGroups.length : gatewayGroups.length

  return (
    <section className="flex min-h-0 w-60 shrink-0 flex-col border-r border-border">
      <header className="shrink-0 px-3 pt-3">
        <div className="flex h-7 items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
            {t('eqp.sidebar.title')}
          </h2>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {t('eqp.list.groupCount', { count: groupCount })}
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder={t(
              scope === 'business'
                ? 'eqp.sidebar.searchPlaceholderBusinessApp'
                : 'eqp.sidebar.searchPlaceholder',
            )}
            className="h-9 bg-muted pl-8 text-xs"
          />
        </div>
      </header>

      {scope === 'business' ? (
        <nav
          className="hover-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3 pt-3"
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
                className={cn(
                  lnbSubLinkClass(selectedBusinessGroupIndex === group.appIndex),
                  'flex items-center gap-1.5',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-left">{group.appName}</span>
                {group.isUnassigned ? (
                  <Badge variant="warning" title={t('eqp.business.unassignedTitle')}>
                    {t('eqp.business.unassignedBadge')}
                  </Badge>
                ) : null}
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
              className="hover-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3 pt-3"
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
                  .map((group) => {
                    const isOpen = expandedGatewayGroups.has(group.appIndex) || hasSearch
                    return (
                      <div key={group.appName} className="flex flex-col gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => toggleGatewayGroup(group.appIndex)}
                          className={lnbGroupClass(selectedGroupIndex === group.appIndex)}
                          aria-expanded={isOpen}
                        >
                          <span className="min-w-0 flex-1 truncate text-left">{group.appName}</span>
                          {group.isUnleased ? (
                            <Badge variant="warning" title={t('eqp.gateway.unleasedTitle')}>
                              {t('eqp.gateway.unleasedBadge')}
                            </Badge>
                          ) : null}
                          <ChevronDown
                            aria-hidden="true"
                            className={cn(
                              'size-3 shrink-0 transition-transform',
                              isOpen ? null : '-rotate-90',
                            )}
                          />
                        </Button>
                        {isOpen
                          ? group.items.map((eqp) =>
                              renderEqpNode(eqp, `${group.appIndex}-${eqp.eqpId}`),
                            )
                          : null}
                      </div>
                    )
                  })
              )}

              {isLoading ? (
                <p className="px-3 pt-1 text-xs text-muted-foreground">
                  {t('eqp.sidebar.loading')}
                </p>
              ) : null}
              {errorMessage ? <p className="px-3 pt-1 text-xs text-danger">{errorMessage}</p> : null}
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
    </section>
  )
})
