import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { SidebarResizeHandle } from '@/components/ui/sidebar-resize-handle'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { buildModelTreeGroups, type ModelTreeNode } from '../lib/model-tree.util'
import type { ModelInfo, ProtocolType } from '../types/model.types'

interface ModelSidebarProps {
  modelItems: ModelInfo[]
  selectedModelVersionKey: number | null
  selectedInterfaceGroup: ProtocolType | null
  sidebarOpen: boolean
  sidebarWidth: number
  isLoading: boolean
  errorMessage: string | null
  onSelectInterfaceGroup: (interfaceType: ProtocolType) => void
  onSelectModel: (model: ModelInfo) => void
  onOpenRootCreate: (interfaceType: ProtocolType) => void
  onOpenRootUpdate: (model: ModelInfo) => void
  onOpenBranchCreate: (model: ModelInfo) => void
  onOpenDeleteDeprecatedBranches: (model: ModelInfo) => void
  onOpenModelDelete: (model: ModelInfo) => void
  onOpenParentCommit: (model: ModelInfo) => void
  onOpenBranchDelete: (model: ModelInfo) => void
  isRootDeleteDisabled: (model: ModelInfo) => boolean
  isDeprecatedBranchDeleteDisabled: (model: ModelInfo) => boolean
  isBranchCommitDisabled: (model: ModelInfo) => boolean
  isBranchDeleteDisabled: (model: ModelInfo) => boolean
  onToggleSidebar: () => void
  onResizeSidebar: (deltaX: number) => void
}

interface SectionProps {
  title: string
  interfaceType: ProtocolType
  nodes: ModelTreeNode[]
  selectedModelName: string | null
  isSelected: boolean
  onSelectInterfaceGroup: (interfaceType: ProtocolType) => void
  onSelectModel: (model: ModelInfo) => void
  onOpenRootCreate: (interfaceType: ProtocolType) => void
  onOpenRootUpdate: (model: ModelInfo) => void
  onOpenBranchCreate: (model: ModelInfo) => void
  onOpenDeleteDeprecatedBranches: (model: ModelInfo) => void
  onOpenModelDelete: (model: ModelInfo) => void
  onOpenParentCommit: (model: ModelInfo) => void
  onOpenBranchDelete: (model: ModelInfo) => void
  isRootDeleteDisabled: (model: ModelInfo) => boolean
  isDeprecatedBranchDeleteDisabled: (model: ModelInfo) => boolean
  isBranchCommitDisabled: (model: ModelInfo) => boolean
  isBranchDeleteDisabled: (model: ModelInfo) => boolean
}

/**
 * Sidebar의 단일 root/branch 노드를 렌더링합니다.
 */
function TreeNode({
  node,
  depth,
  selectedModelName,
  onSelectModel,
  onOpenRootUpdate,
  onOpenBranchCreate,
  onOpenDeleteDeprecatedBranches,
  onOpenModelDelete,
  onOpenParentCommit,
  onOpenBranchDelete,
  isRootDeleteDisabled,
  isDeprecatedBranchDeleteDisabled,
  isBranchCommitDisabled,
  isBranchDeleteDisabled,
}: Omit<
  SectionProps,
  'title' | 'interfaceType' | 'nodes' | 'isSelected' | 'onSelectInterfaceGroup' | 'onOpenRootCreate'
> & {
  node: ModelTreeNode
  depth: number
}) {
  const isSelected = selectedModelName === node.representative.modelName
  const isRootModel = !node.representative.parentModel
  const isDeprecatedNode = node.latestStatus.trim().toUpperCase() === 'DEPRECATED'

  const triggerButton = (
    <button
      type="button"
      onClick={() => onSelectModel(node.representative)}
      className={cn(
        'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
        isSelected
          ? 'bg-[#EAF5EE] text-[#1F2D26]'
          : 'text-[#51605A] hover:bg-[#F1F6F3]',
      )}
    >
      <span
        className={cn(
          'mt-1.5 inline-block size-1.5 shrink-0 rounded-full',
          isSelected ? 'bg-[#2AAE67]' : 'bg-[#9AACA2]',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">
          {node.representative.modelName}
        </span>
      </span>
      {isDeprecatedNode ? (
        <span className="shrink-0 rounded-full border border-[#EFC7B4] bg-[#FFF5EF] px-2 py-0.5 text-[10px] font-semibold text-[#A05A39]">
          DEPRECATED
        </span>
      ) : null}
    </button>
  )

  return (
    <div className={cn('space-y-1', depth > 0 ? 'ml-3 border-l border-[#E1E9E4] pl-3' : null)}>
      <ContextMenu>
        <ContextMenuTrigger asChild>{triggerButton}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuLabel>{node.representative.modelName}</ContextMenuLabel>
          <ContextMenuSeparator />
          {isRootModel ? (
            <>
              <ContextMenuItem onSelect={() => onOpenRootUpdate(node.representative)}>
                Model Info Update
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onOpenBranchCreate(node.representative)}>
                Branch Model Create
              </ContextMenuItem>
              <ContextMenuItem
                disabled={isDeprecatedBranchDeleteDisabled(node.representative)}
                onSelect={() => onOpenDeleteDeprecatedBranches(node.representative)}
              >
                Branch Deprecated Model Delete
              </ContextMenuItem>
              <ContextMenuItem
                variant="destructive"
                disabled={isRootDeleteDisabled(node.representative)}
                onSelect={() => onOpenModelDelete(node.representative)}
              >
                Model Delete
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem
                disabled={isBranchCommitDisabled(node.representative)}
                onSelect={() => onOpenParentCommit(node.representative)}
              >
                Parent Model Commit
              </ContextMenuItem>
              <ContextMenuItem
                variant="destructive"
                disabled={isBranchDeleteDisabled(node.representative)}
                onSelect={() => onOpenBranchDelete(node.representative)}
              >
                Branch Model Delete
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {node.branches.length > 0 ? (
        <div className="space-y-1">
          {node.branches.map((branchNode) => (
            <TreeNode
              key={`${branchNode.representative.modelName}-${branchNode.representative.modelVersionKey}`}
              node={branchNode}
              depth={depth + 1}
              selectedModelName={selectedModelName}
              onSelectModel={onSelectModel}
              onOpenRootUpdate={onOpenRootUpdate}
              onOpenBranchCreate={onOpenBranchCreate}
              onOpenDeleteDeprecatedBranches={onOpenDeleteDeprecatedBranches}
              onOpenModelDelete={onOpenModelDelete}
              onOpenParentCommit={onOpenParentCommit}
              onOpenBranchDelete={onOpenBranchDelete}
              isRootDeleteDisabled={isRootDeleteDisabled}
              isDeprecatedBranchDeleteDisabled={isDeprecatedBranchDeleteDisabled}
              isBranchCommitDisabled={isBranchCommitDisabled}
              isBranchDeleteDisabled={isBranchDeleteDisabled}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 통신 프로토콜별 섹션을 렌더링합니다.
 */
function InterfaceSection({
  title,
  interfaceType,
  nodes,
  selectedModelName,
  isSelected,
  onSelectInterfaceGroup,
  onSelectModel,
  onOpenRootCreate,
  onOpenRootUpdate,
  onOpenBranchCreate,
  onOpenDeleteDeprecatedBranches,
  onOpenModelDelete,
  onOpenParentCommit,
  onOpenBranchDelete,
  isRootDeleteDisabled,
  isDeprecatedBranchDeleteDisabled,
  isBranchCommitDisabled,
  isBranchDeleteDisabled,
}: SectionProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <section className="rounded-lg border border-[#DDE8E1] bg-[#FAFCFB] p-2">
          <button
            type="button"
            onClick={() => onSelectInterfaceGroup(interfaceType)}
            className={cn(
              'mb-1 w-full rounded-sm px-1 py-0.5 text-left text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
              isSelected
                ? 'bg-[#EAF5EE] text-[#1F2D26]'
                : 'text-[#315343] hover:bg-[#F1F6F3]',
            )}
          >
            {title}
          </button>
          <div className="space-y-2 pl-1">
            {nodes.length === 0 ? (
              <p className="py-1 text-[11px] text-[#97A39C]">표시할 모델이 없습니다.</p>
            ) : (
              nodes.map((node) => (
                <TreeNode
                  key={`${node.representative.modelName}-${node.representative.modelVersionKey}`}
                  node={node}
                  depth={0}
                  selectedModelName={selectedModelName}
                  onSelectModel={onSelectModel}
                  onOpenRootUpdate={onOpenRootUpdate}
                  onOpenBranchCreate={onOpenBranchCreate}
                  onOpenDeleteDeprecatedBranches={onOpenDeleteDeprecatedBranches}
                  onOpenModelDelete={onOpenModelDelete}
                  onOpenParentCommit={onOpenParentCommit}
                  onOpenBranchDelete={onOpenBranchDelete}
                  isRootDeleteDisabled={isRootDeleteDisabled}
                  isDeprecatedBranchDeleteDisabled={isDeprecatedBranchDeleteDisabled}
                  isBranchCommitDisabled={isBranchCommitDisabled}
                  isBranchDeleteDisabled={isBranchDeleteDisabled}
                />
              ))
            )}
          </div>
        </section>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuLabel>{title}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onOpenRootCreate(interfaceType)}>
          {title === 'SECS' ? 'SECS Model Create' : 'Socket Model Create'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/**
 * Model 페이지 좌측 Sidebar 컴포넌트입니다.
 * parent(root) → branch 구조를 항상 펼친 상태로 표시하고 각 노드에 관리 컨텍스트 메뉴를 연결합니다.
 */
export function ModelSidebar({
  modelItems,
  selectedModelVersionKey,
  selectedInterfaceGroup,
  sidebarOpen,
  sidebarWidth,
  isLoading,
  errorMessage,
  onSelectInterfaceGroup,
  onSelectModel,
  onOpenRootCreate,
  onOpenRootUpdate,
  onOpenBranchCreate,
  onOpenDeleteDeprecatedBranches,
  onOpenModelDelete,
  onOpenParentCommit,
  onOpenBranchDelete,
  isRootDeleteDisabled,
  isDeprecatedBranchDeleteDisabled,
  isBranchCommitDisabled,
  isBranchDeleteDisabled,
  onToggleSidebar,
  onResizeSidebar,
}: ModelSidebarProps) {
  const [searchKeyword, setSearchKeyword] = useState('')

  const selectedModel = useMemo(
    () => modelItems.find((item) => item.modelVersionKey === selectedModelVersionKey) ?? null,
    [modelItems, selectedModelVersionKey],
  )

  const { secsRoots, socketRoots } = useMemo(
    () => buildModelTreeGroups(modelItems, searchKeyword),
    [modelItems, searchKeyword],
  )

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
            <span className="truncate text-sm font-semibold text-[#243129]">Model Info</span>
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
                placeholder="Model Name 검색"
                className="h-9 bg-[#F7FAF8] pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
            <InterfaceSection
              title="SECS"
              interfaceType="SECS"
              nodes={secsRoots}
              selectedModelName={selectedModel?.modelName ?? null}
              isSelected={selectedInterfaceGroup === 'SECS'}
              onSelectInterfaceGroup={onSelectInterfaceGroup}
              onSelectModel={onSelectModel}
              onOpenRootCreate={onOpenRootCreate}
              onOpenRootUpdate={onOpenRootUpdate}
              onOpenBranchCreate={onOpenBranchCreate}
              onOpenDeleteDeprecatedBranches={onOpenDeleteDeprecatedBranches}
              onOpenModelDelete={onOpenModelDelete}
              onOpenParentCommit={onOpenParentCommit}
              onOpenBranchDelete={onOpenBranchDelete}
              isRootDeleteDisabled={isRootDeleteDisabled}
              isDeprecatedBranchDeleteDisabled={isDeprecatedBranchDeleteDisabled}
              isBranchCommitDisabled={isBranchCommitDisabled}
              isBranchDeleteDisabled={isBranchDeleteDisabled}
            />

            <InterfaceSection
              title="Socket"
              interfaceType="SOCKET"
              nodes={socketRoots}
              selectedModelName={selectedModel?.modelName ?? null}
              isSelected={selectedInterfaceGroup === 'SOCKET'}
              onSelectInterfaceGroup={onSelectInterfaceGroup}
              onSelectModel={onSelectModel}
              onOpenRootCreate={onOpenRootCreate}
              onOpenRootUpdate={onOpenRootUpdate}
              onOpenBranchCreate={onOpenBranchCreate}
              onOpenDeleteDeprecatedBranches={onOpenDeleteDeprecatedBranches}
              onOpenModelDelete={onOpenModelDelete}
              onOpenParentCommit={onOpenParentCommit}
              onOpenBranchDelete={onOpenBranchDelete}
              isRootDeleteDisabled={isRootDeleteDisabled}
              isDeprecatedBranchDeleteDisabled={isDeprecatedBranchDeleteDisabled}
              isBranchCommitDisabled={isBranchCommitDisabled}
              isBranchDeleteDisabled={isBranchDeleteDisabled}
            />

            {isLoading ? <p className="px-2 text-xs text-[#6D7972]">모델 목록을 불러오는 중입니다.</p> : null}
            {errorMessage ? <p className="px-2 text-xs text-[#C5534B]">{errorMessage}</p> : null}
          </div>
        </div>

        <SidebarResizeHandle onDrag={onResizeSidebar} />
      </div>
    </aside>
  )
}
