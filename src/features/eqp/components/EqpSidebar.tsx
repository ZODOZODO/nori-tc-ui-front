import { memo, useDeferredValue, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
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
import { lnbLeafClass, lnbLeafDotClass, lnbSubLinkClass } from '@/shared/layout/lnb-sidebar'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { EqpInfo, GatewayShardLease, ProtocolType } from '../types/eqp.types'
import { groupEqpItems } from '../utils/eqp-group.util'

interface EqpSidebarProps {
  /** 현재 스코프. 상단 현황 카드가 정한다 — 이 스코프의 하위 트리만 그린다. */
  scope: 'business' | 'gateway'
  eqpItems: EqpInfo[]
  /** gateway 그룹 분류 기준이 되는 shard lease 점유 현황 (조회 전이면 undefined) */
  shardLeases: GatewayShardLease[] | undefined
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

  const groupCount = scope === 'business' ? businessGroups.length : gatewayGroups.length

  return (
    <section className="flex min-h-0 w-[38%] min-w-80 max-w-115 shrink-0 flex-col border-r border-border">
      <header className="shrink-0 border-b border-border px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{t('eqp.sidebar.title')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(scope === 'business' ? 'eqp.list.businessHint' : 'eqp.list.gatewayHint')}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
            {t('eqp.list.groupCount', { count: groupCount })}
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder={t('eqp.sidebar.searchPlaceholder')}
            className="h-10 rounded-xl bg-background pl-9"
          />
        </div>
      </header>

      {scope === 'business' ? (
        <nav
          className="hover-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3"
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
              className="hover-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3"
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
