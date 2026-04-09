import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { EqpInfo, ProtocolType } from '../types/eqp.types'
import { useMemo, useState } from 'react'
import { groupEqpItems } from '../utils/eqp-group.util'

interface EqpSidebarProps {
  eqpItems: EqpInfo[]
  selectedEqpId: string | null
  isGatewaySelected: boolean
  isBusinessSelected: boolean
  selectedBusinessGroupIndex: number | null
  selectedGroupIndex: number | null
  sidebarOpen: boolean
  sidebarWidth: number
  isLoading: boolean
  errorMessage: string | null
  onSelectEqp: (eqpId: string) => void
  onSelectGatewayAll: () => void
  onSelectBusinessAll: () => void
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
 * design.pen의 EqpSidebarExpanded/Collapsed 구조를 기반으로 만든 사이드바입니다.
 * 실제 EQP 데이터는 useEqpList 결과를 사용하고, 검색은 eqpId 기준으로 필터링합니다.
 *
 * Gateway / gateway_app 그룹명은 클릭 가능한 버튼으로 표시됩니다.
 * 그룹화 로직은 eqp-group.util.ts의 groupEqpItems 함수를 사용합니다.
 * self-stretch를 통해 부모 flex 컨테이너 높이 전체를 항상 채웁니다.
 */
export function EqpSidebar({
  eqpItems,
  selectedEqpId,
  isGatewaySelected,
  isBusinessSelected,
  selectedBusinessGroupIndex,
  selectedGroupIndex,
  sidebarOpen,
  sidebarWidth,
  isLoading,
  errorMessage,
  onSelectEqp,
  onSelectGatewayAll,
  onSelectBusinessAll,
  onSelectGatewayGroup,
  onSelectBusinessGroup,
  onOpenEqpInfoUpdate,
  onOpenEqpModelBinding,
  onOpenEqpDelete,
  onOpenEqpCreate,
  onToggleSidebar,
  onResizeSidebar,
}: EqpSidebarProps) {
  const [searchKeyword, setSearchKeyword] = useState('')

  const filteredEqpItems = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase()

    if (!normalizedKeyword) {
      return eqpItems
    }

    return eqpItems.filter((eqp) => eqp.eqpId.toLowerCase().includes(normalizedKeyword))
  }, [eqpItems, searchKeyword])

  /**
   * 검색 필터 후 groupEqpItems 유틸로 그룹화합니다.
   * 검색 결과 기준으로 그룹이 재계산됩니다.
   */
  const { gatewayGroups, businessGroups } = useMemo(
    () => groupEqpItems(filteredEqpItems),
    [filteredEqpItems],
  )

  const renderEqpNode = (eqp: EqpInfo, key: string) => {
    const isSelected = selectedEqpId === eqp.eqpId

    return (
      <ContextMenu key={key}>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => onSelectEqp(eqp.eqpId)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
              isSelected
                ? 'bg-[#EAF5EE] font-semibold text-[#1F2D26]'
                : 'text-[#51605A] hover:bg-[#F1F6F3]',
            )}
          >
            <span
              className={cn(
                'inline-block size-1.5 rounded-full',
                isSelected ? 'bg-[#2AAE67]' : 'bg-[#9AACA2]',
              )}
            />
            <span>{eqp.eqpId}</span>
          </button>
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
        className="flex flex-col self-stretch border-r border-[#E4EAE6] bg-white"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="flex h-[52px] items-center justify-center border-b border-[#E4EAE6]">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex size-8 items-center justify-center rounded-md border border-[#D8E1DB] text-[#516058] hover:bg-[#F2F7F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
            aria-label="사이드바 펼치기"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="flex flex-col self-stretch border-r border-[#E4EAE6] bg-white"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="flex min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[52px] items-center justify-between border-b border-[#E4EAE6] px-3">
            <span className="truncate text-sm font-semibold text-[#243129]">Eqp Info</span>
            <button
              type="button"
              onClick={onToggleSidebar}
              className="flex size-8 items-center justify-center rounded-md border border-[#D8E1DB] text-[#516058] hover:bg-[#F2F7F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
              aria-label="사이드바 축소"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>

          <div className="px-3 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#9AA49E]" />
              <Input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="Eqp 검색"
                className="h-9 bg-[#F7FAF8] pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
            <section className="rounded-lg border border-[#DDE8E1] bg-[#FAFCFB] p-2">
              <button
                type="button"
                onClick={onSelectBusinessAll}
                className={cn(
                  'mb-1 w-full rounded-sm px-1 py-0.5 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
                  isBusinessSelected
                    ? 'bg-[#EAF5EE] text-[#1F2D26]'
                    : 'text-[#315343] hover:bg-[#F1F6F3]',
                )}
              >
                Business
              </button>
              <div className="space-y-1 pl-2">
                {businessGroups.length === 0 ? (
                  <p className="py-1 text-[11px] text-[#97A39C]">표시할 비즈니스 그룹이 없습니다.</p>
                ) : (
                  businessGroups.map((group) => (
                    <div key={group.appName} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => onSelectBusinessGroup(group.appIndex)}
                        className={cn(
                          'w-full rounded-md px-2 py-1 text-left text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
                          selectedBusinessGroupIndex === group.appIndex
                            ? 'bg-[#EAF5EE] font-semibold text-[#1F2D26]'
                            : 'text-[#51605A] hover:bg-[#F1F6F3]',
                        )}
                      >
                        {group.appName}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <ContextMenu>
              <section className="rounded-lg border border-[#DDE8E1] bg-[#FAFCFB] p-2">
                <ContextMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={onSelectGatewayAll}
                    className={cn(
                      'mb-1 w-full rounded-sm px-1 py-0.5 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
                      isGatewaySelected
                        ? 'bg-[#EAF5EE] text-[#1F2D26]'
                        : 'text-[#315343] hover:bg-[#F1F6F3]',
                    )}
                  >
                    Gateway
                  </button>
                </ContextMenuTrigger>
                <div className="space-y-1 pl-2">
                  {gatewayGroups.length === 0 ? (
                    <p className="py-1 text-[11px] text-[#97A39C]">표시할 게이트웨이 그룹이 없습니다.</p>
                  ) : (
                    gatewayGroups.map((group) => (
                      <div key={group.appName} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => onSelectGatewayGroup(group.appIndex)}
                          className={cn(
                            'w-full rounded-md px-2 py-1 text-left text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
                            selectedGroupIndex === group.appIndex
                              ? 'bg-[#EAF5EE] font-semibold text-[#1F2D26]'
                              : 'text-[#51605A] hover:bg-[#F1F6F3]',
                          )}
                        >
                          {group.appName}
                        </button>
                        <div className="space-y-1 pl-3">
                          {group.items.map((eqp) =>
                            renderEqpNode(eqp, `${group.appIndex}-${eqp.eqpId}`),
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
              <ContextMenuContent className="w-52">
                <ContextMenuLabel>Gateway</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => onOpenEqpCreate('SECS')}>SECS Eqp Create</ContextMenuItem>
                <ContextMenuItem onSelect={() => onOpenEqpCreate('SOCKET')}>Socket Eqp Create</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            {isLoading ? <p className="px-2 text-xs text-[#6D7972]">설비 목록을 불러오는 중입니다.</p> : null}
            {errorMessage ? <p className="px-2 text-xs text-[#C5534B]">{errorMessage}</p> : null}
          </div>
        </div>

        <SidebarResizeHandle onDrag={onResizeSidebar} />
      </div>
    </aside>
  )
}
