import { Search } from 'lucide-react'
import { memo, useDeferredValue, useMemo, useState } from 'react'
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
import { InPageSidebar } from '@/shared/layout/InPageSidebar'
import { lnbLeafClass, lnbLeafDotClass, lnbSubLinkClass } from '@/shared/layout/lnb-sidebar'
import { buildModelTreeGroups, type ModelTreeNode } from '../lib/model-tree.util'
import type { ModelInfo, ProtocolType } from '../types/model.types'

interface ModelSidebarProps {
  /** 현재 라우트 스코프. 이 인터페이스의 root 트리만 그린다(SECS/Socket/PLC 는 전역 LNB 소관). */
  scope: ProtocolType
  modelItems: ModelInfo[]
  selectedModelVersionKey: number | null
  sidebarOpen: boolean
  sidebarWidth: number
  isLoading: boolean
  errorMessage: string | null
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
 * 스코프의 화면 표기입니다 — 라벨은 승격 전 섹션 헤더와 같은 문자열을 유지한다
 * ('Socket Model Create' 등 우클릭 메뉴 문안이 바뀌지 않게).
 */
const SCOPE_TITLE: Readonly<Record<string, string>> = {
  SECS: 'SECS',
  SOCKET: 'Socket',
  PLC: 'PLC',
}

/** 라우트 스코프 → 트리 그룹 선택. */
const resolveScopedRoots = (
  scope: ProtocolType,
  groups: ReturnType<typeof buildModelTreeGroups>,
): ModelTreeNode[] => {
  const normalized = scope.toUpperCase()
  if (normalized === 'SOCKET') {
    return groups.socketRoots
  }
  if (normalized === 'PLC') {
    return groups.plcRoots
  }
  return groups.secsRoots
}

/**
 * Model 페이지의 in-page 2차 내비입니다 — 현재 라우트 스코프의 root > branch 트리만 담당합니다.
 *
 * 1단계였던 SECS / Socket / PLC 섹션 헤더는 전역 LNB 의 menu-label 로 승격돼 여기서 사라졌다
 * (`/model/secs` · `/model/socket` · `/model/plc`). 남은 것은 그 인터페이스의 root 목록,
 * root 하위 branch 아코디언, 검색, 우클릭 CRUD 다. 시각 클래스는 eqp 와 공유한다.
 */
export const ModelSidebar = memo(function ModelSidebar({
  scope,
  modelItems,
  selectedModelVersionKey,
  sidebarOpen,
  sidebarWidth,
  isLoading,
  errorMessage,
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

  const roots = useMemo(
    () => resolveScopedRoots(scope, buildModelTreeGroups(modelItems, deferredSearchKeyword)),
    [modelItems, deferredSearchKeyword, scope],
  )
  const scopeTitle = SCOPE_TITLE[scope.toUpperCase()] ?? scope

  // root 별 하위 branch 펼침/접힘. root 클릭으로 토글.
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    const owner = findOwningRootName(roots, selectedModelVersionKey)
    if (owner) {
      initial.add(owner)
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
        // 하위 안내선은 두지 않는다(전역 LNB 와 동일) — 들여쓰기만으로 depth 를 나타낸다.
        className={depth > 1 ? 'ml-3 pl-1' : undefined}
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
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
            </Button>
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onSelectModel(node.representative)
                toggleRoot(rootName)
              }}
              className={lnbSubLinkClass(isSelected)}
            >
              {rootName}
            </Button>
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

  return (
    <InPageSidebar
      title={t('model.sidebar.title')}
      open={sidebarOpen}
      width={sidebarWidth}
      expandLabel={t('model.sidebar.expand')}
      collapseLabel={t('model.sidebar.collapse')}
      onToggle={onToggleSidebar}
      onResize={onResizeSidebar}
    >
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

      {/* Model Create 우클릭 메뉴는 승격된 섹션 헤더 대신 트리 컨테이너가 받는다
          (생성 대상 인터페이스 = 현재 라우트 스코프). */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <nav
            className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3"
            data-testid="model-sidebar-tree"
          >
            {roots.length === 0 ? (
              <p className="py-1 pl-8 text-[11px] text-muted-foreground">
                {t('model.sidebar.empty')}
              </p>
            ) : (
              roots.map((root) => renderRoot(root))
            )}

            {isLoading ? (
              <p className="px-3 pt-1 text-xs text-muted-foreground">
                {t('model.sidebar.loading')}
              </p>
            ) : null}
            {errorMessage ? <p className="px-3 pt-1 text-xs text-danger">{errorMessage}</p> : null}
          </nav>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuLabel>{scopeTitle}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onOpenRootCreate(scope)}>
            {`${scopeTitle} Model Create`}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </InPageSidebar>
  )
})
