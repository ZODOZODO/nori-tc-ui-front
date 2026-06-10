import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { memo, useDeferredValue, useMemo, useState } from 'react'
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
import { useI18n } from '@/i18n/i18n-context'
import {
  LNB_FOCUS_RING,
  lnbGroupClass,
  lnbLeafClass,
  lnbLeafDotClass,
  lnbSubLinkClass,
} from '@/shared/layout/lnb-sidebar'
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

const isDeprecatedNode = (node: ModelTreeNode): boolean =>
  node.latestStatus.trim().toUpperCase() === 'DEPRECATED'

/**
 * 선택된 modelVersionKey 를 포함하는 최상위 root 노드의 modelName 을 찾습니다.
 * 아코디언 lazy-init(새로고침 복원 시 선택 모델의 root 를 펼쳐 보여주기) 용도.
 */
const findOwningRootName = (roots: ModelTreeNode[], selectedKey: number | null): string | null => {
  if (selectedKey === null) {
    return null
  }
  const contains = (node: ModelTreeNode): boolean =>
    node.representative.modelVersionKey === selectedKey || node.branches.some(contains)
  return roots.find(contains)?.representative.modelName ?? null
}

/**
 * Model 페이지 좌측 Sidebar.
 *
 * nori-client 리뉴얼 LNB 의 3단 클릭 아코디언을 EqpSidebar 와 동일 패턴으로 적용한다:
 *   SECS / Socket 섹션(그룹 헤더, 클릭 = 인터페이스 그룹 선택 + 펼침/접힘)
 *     → operator/root 모델(하위 링크, 클릭 = 선택 + 하위 branch 펼침/접힘)
 *       → branch 모델(리프, root 펼쳤을 때만 노출)
 * 시각 클래스는 `@/shared/layout/lnb-sidebar` 공용 헬퍼(eqp/model 공유). 선택/라우팅/
 * ContextMenu/검색/testId 불변(R4.1), R4.2(접기/리사이즈) 인프라 그대로.
 */
export const ModelSidebar = memo(function ModelSidebar({
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
  const { t } = useI18n()
  const [searchKeyword, setSearchKeyword] = useState('')
  // 입력 자체는 즉시 반영, 트리 빌드는 deferred 로 — 큰 목록에서 입력 지연 완화.
  const deferredSearchKeyword = useDeferredValue(searchKeyword)

  const selectedModel = useMemo(
    () => modelItems.find((item) => item.modelVersionKey === selectedModelVersionKey) ?? null,
    [modelItems, selectedModelVersionKey],
  )
  const selectedModelName = selectedModel?.modelName ?? null

  const { secsRoots, socketRoots, plcRoots } = useMemo(
    () => buildModelTreeGroups(modelItems, deferredSearchKeyword),
    [modelItems, deferredSearchKeyword],
  )

  // 섹션 펼침/접힘 (nori-client sidebar__top 아코디언). 초기값 = 선택 컨텍스트 기반.
  const [secsOpen, setSecsOpen] = useState(
    () =>
      selectedInterfaceGroup === 'SECS' || findOwningRootName(secsRoots, selectedModelVersionKey) !== null,
  )
  const [socketOpen, setSocketOpen] = useState(
    () =>
      selectedInterfaceGroup === 'SOCKET' ||
      findOwningRootName(socketRoots, selectedModelVersionKey) !== null,
  )
  const [plcOpen, setPlcOpen] = useState(
    () =>
      selectedInterfaceGroup === 'PLC' ||
      findOwningRootName(plcRoots, selectedModelVersionKey) !== null,
  )
  // root 별 하위 branch 펼침/접힘 (2단계 아코디언). root 클릭으로 토글.
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    const secsOwner = findOwningRootName(secsRoots, selectedModelVersionKey)
    const socketOwner = findOwningRootName(socketRoots, selectedModelVersionKey)
    const plcOwner = findOwningRootName(plcRoots, selectedModelVersionKey)
    if (secsOwner) {
      initial.add(secsOwner)
    }
    if (socketOwner) {
      initial.add(socketOwner)
    }
    if (plcOwner) {
      initial.add(plcOwner)
    }
    return initial
  })
  // 검색 중에는 결과가 접혀 안 보이는 걸 막기 위해 모두 강제로 펼친다(파생값, effect 미사용).
  const hasSearch = deferredSearchKeyword.trim().length > 0

  const toggleRoot = (modelName: string) => {
    setExpandedRoots((prev) => {
      const next = new Set(prev)
      if (next.has(modelName)) {
        next.delete(modelName)
      } else {
        next.add(modelName)
      }
      return next
    })
  }

  /** branch 리프 노드 (root 펼쳤을 때 노출, 다단 branch 는 들여쓰기 재귀). */
  const renderBranch = (node: ModelTreeNode, depth: number) => {
    const isSelected = selectedModelName === node.representative.modelName
    return (
      <div
        key={`${node.representative.modelName}-${node.representative.modelVersionKey}`}
        className={depth > 1 ? 'ml-3 border-l border-border pl-1' : undefined}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              onClick={() => onSelectModel(node.representative)}
              className={lnbLeafClass(isSelected)}
            >
              <span className={lnbLeafDotClass(isSelected)} />
              <span className="min-w-0 flex-1 truncate">{node.representative.modelName}</span>
              {isDeprecatedNode(node) ? (
                <span className="shrink-0 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                  DEPRECATED
                </span>
              ) : null}
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56">
            <ContextMenuLabel>{node.representative.modelName}</ContextMenuLabel>
            <ContextMenuSeparator />
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
          </ContextMenuContent>
        </ContextMenu>
        {node.branches.map((child) => renderBranch(child, depth + 1))}
      </div>
    )
  }

  /** operator/root 모델 (하위 링크 + 클릭 시 branch 펼침/접힘). */
  const renderRoot = (node: ModelTreeNode) => {
    const isSelected = selectedModelName === node.representative.modelName
    const rootName = node.representative.modelName
    return (
      <div key={`${rootName}-${node.representative.modelVersionKey}`} className="flex flex-col gap-0.5">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              onClick={() => {
                onSelectModel(node.representative)
                toggleRoot(rootName)
              }}
              className={lnbSubLinkClass(isSelected)}
            >
              {rootName}
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56">
            <ContextMenuLabel>{rootName}</ContextMenuLabel>
            <ContextMenuSeparator />
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
          </ContextMenuContent>
        </ContextMenu>
        {expandedRoots.has(rootName) || hasSearch
          ? node.branches.map((branch) => renderBranch(branch, 1))
          : null}
      </div>
    )
  }

  /** SECS / Socket 섹션 (그룹 헤더 아코디언 + root 목록). */
  const renderSection = (
    title: string,
    interfaceType: ProtocolType,
    roots: ModelTreeNode[],
    isOpen: boolean,
    onToggleOpen: () => void,
  ) => (
    <ContextMenu>
      <div className="flex flex-col gap-0.5">
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => {
              onSelectInterfaceGroup(interfaceType)
              onToggleOpen()
            }}
            className={lnbGroupClass(selectedInterfaceGroup === interfaceType)}
          >
            <span className="flex-1 truncate">{title}</span>
          </button>
        </ContextMenuTrigger>
        {isOpen || hasSearch ? (
          roots.length === 0 ? (
            <p className="py-1 pl-8 text-[11px] text-muted-foreground">{t('model.sidebar.empty')}</p>
          ) : (
            roots.map((root) => renderRoot(root))
          )
        ) : null}
      </div>
      <ContextMenuContent className="w-52">
        <ContextMenuLabel>{title}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onOpenRootCreate(interfaceType)}>
          {`${title} Model Create`}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )

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
              LNB_FOCUS_RING,
            )}
            aria-label={t('model.sidebar.expand')}
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
            <span className="truncate text-sm font-semibold text-foreground">{t('model.sidebar.title')}</span>
            <button
              type="button"
              onClick={onToggleSidebar}
              className={cn(
                'flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted',
                LNB_FOCUS_RING,
              )}
              aria-label={t('model.sidebar.collapse')}
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>

          <div className="px-3 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder={t('model.sidebar.searchPlaceholder')}
                className="h-9 bg-muted pl-8 text-xs"
              />
            </div>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
            {renderSection('SECS', 'SECS', secsRoots, secsOpen, () => setSecsOpen((open) => !open))}
            <div className="mt-2 flex flex-col gap-0.5">
              {renderSection('Socket', 'SOCKET', socketRoots, socketOpen, () =>
                setSocketOpen((open) => !open),
              )}
            </div>
            <div className="mt-2 flex flex-col gap-0.5">
              {renderSection('PLC', 'PLC', plcRoots, plcOpen, () => setPlcOpen((open) => !open))}
            </div>

            {isLoading ? (
              <p className="px-3 pt-1 text-xs text-muted-foreground">{t('model.sidebar.loading')}</p>
            ) : null}
            {errorMessage ? <p className="px-3 pt-1 text-xs text-danger">{errorMessage}</p> : null}
          </nav>
        </div>

        <SidebarResizeHandle onDrag={onResizeSidebar} />
      </div>
    </aside>
  )
})
