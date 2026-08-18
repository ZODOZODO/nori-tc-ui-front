import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/i18n-context'
import {
  buildFlowFilterValue,
  createEmptyFlowFilterCondition,
  createEmptyFlowGroup,
  createTransformDraft,
  LOOKUP_SOURCE_OPTIONS,
  parseFlowFilterEditor,
  type TransformDraft,
  type FlowComparison,
  type FlowFilterEditorDraft,
  type FlowGroupDraft,
  type FlowLookupSource,
  type FlowNodeDraft,
  FLOW_COMPARISON_OPTIONS,
} from '../lib/model-detail-editor'

/**
 * workflow_filter 편집 모달입니다.
 *
 * ModelDetailPanel.tsx 의 inline Dialog 블록(line 1587~1657) 을 별 파일로 추출.
 * 외부 props 시그니처는 `open / value / readOnly / titleLabel / errorMessage / onClose / onSave`
 * 로 자기완결 — 내부 draft state 도 모달 안에서 관리하여 호출자는 raw JSON string
 * 만 주고받습니다 (기존 onChangeDetailValue 계약과 호환).
 */

interface FlowFilterEditorModalProps {
  open: boolean
  value: string
  readOnly: boolean
  titleLabel: string
  errorMessage: string | null
  onClose: () => void
  onSave: (nextValue: string) => void
}

export function FlowFilterEditorModal({
  open,
  value,
  readOnly,
  titleLabel,
  errorMessage,
  onClose,
  onSave,
}: FlowFilterEditorModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
    >
      {open ? (
        <FlowFilterEditorModalBody
          // key 로 open 전환 시 body 를 새로 mount — draft 가 새 value 로 자연 reset.
          key={value}
          value={value}
          readOnly={readOnly}
          titleLabel={titleLabel}
          errorMessage={errorMessage}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  )
}

interface FlowFilterEditorModalBodyProps {
  value: string
  readOnly: boolean
  titleLabel: string
  errorMessage: string | null
  onClose: () => void
  onSave: (nextValue: string) => void
}

function FlowFilterEditorModalBody({
  value,
  readOnly,
  titleLabel,
  errorMessage,
  onClose,
  onSave,
}: FlowFilterEditorModalBodyProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<FlowFilterEditorDraft>(() =>
    parseFlowFilterEditor(value),
  )

  const handleUpdateNode = (
    targetId: string,
    patcher: (targetNode: FlowNodeDraft) => FlowNodeDraft,
  ) => {
    setDraft((previousDraft) => ({
      ...previousDraft,
      rootGroup: updateFlowNode(previousDraft.rootGroup, targetId, patcher) as FlowGroupDraft,
    }))
  }

  const handleAddCondition = (groupId: string) => {
    setDraft((previousDraft) => ({
      ...previousDraft,
      rootGroup: addFlowChildNode(
        previousDraft.rootGroup,
        groupId,
        createEmptyFlowFilterCondition(),
      ) as FlowGroupDraft,
    }))
  }

  const handleAddGroup = (groupId: string) => {
    setDraft((previousDraft) => ({
      ...previousDraft,
      rootGroup: addFlowChildNode(
        previousDraft.rootGroup,
        groupId,
        createEmptyFlowGroup('and'),
      ) as FlowGroupDraft,
    }))
  }

  const handleRemoveNode = (nodeId: string) => {
    setDraft((previousDraft) => ({
      ...previousDraft,
      rootGroup: removeFlowNode(previousDraft.rootGroup, nodeId),
    }))
  }

  const handleSave = () => {
    if (readOnly) {
      return
    }
    onSave(buildFlowFilterValue(draft))
  }

  return (
    <DialogContent
      className="!left-4 !right-4 !top-4 !bottom-4 !w-auto !max-w-none !translate-x-0 !translate-y-0 overflow-hidden p-0 md:!left-6 md:!right-6 md:!top-6 md:!bottom-6"
      onOpenAutoFocus={(event) => event.preventDefault()}
    >
      <div className="flex h-full min-h-0 flex-col">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
          <DialogTitle>{titleLabel || t('model.flowEditor.title')}</DialogTitle>
          <DialogDescription>
            {t('model.flowEditor.filterDesc')}
          </DialogDescription>
        </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
            <div className="flex h-full min-h-0 flex-col gap-3">
              {errorMessage ? (
                <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {errorMessage}
                </p>
              ) : null}

              {draft.mode === 'raw' ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <p className="text-sm text-danger">
                    {t('model.flowEditor.rawModeNotice')}
                  </p>
                  <textarea
                    value={draft.rawValue}
                    onChange={(event) =>
                      setDraft((previousDraft) => ({
                        ...previousDraft,
                        rawValue: event.target.value,
                      }))
                    }
                    className="min-h-0 w-full flex-1 resize-none overflow-auto rounded-xl border border-border bg-muted p-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                    readOnly={readOnly}
                  />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <div className="rounded-2xl border border-border bg-muted px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">
                      {t('model.flowEditor.groupCompose')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('model.flowEditor.expectedHint')}
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <FlowNodeEditor
                      node={draft.rootGroup}
                      depth={0}
                      readOnly={readOnly}
                      onUpdateNode={handleUpdateNode}
                      onAddCondition={handleAddCondition}
                      onAddGroup={handleAddGroup}
                      onRemoveNode={handleRemoveNode}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {!readOnly ? <Button onClick={handleSave}>{t('common.save')}</Button> : null}
        </DialogFooter>
      </div>
    </DialogContent>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers — ModelDetailPanel.tsx 에서 그대로 옮긴 트리 변환 헬퍼.
// 외부 export 하지 않음 (file split 의 일부, surgical change).
// ─────────────────────────────────────────────────────────────────────────────

const ensureGroupChildren = (children: FlowNodeDraft[]): FlowNodeDraft[] =>
  children.length > 0 ? children : [createEmptyFlowFilterCondition()]

const updateFlowNode = (
  node: FlowNodeDraft,
  targetId: string,
  patcher: (targetNode: FlowNodeDraft) => FlowNodeDraft,
): FlowNodeDraft => {
  if (node.id === targetId) {
    return patcher(node)
  }

  if (node.nodeType === 'condition') {
    return node
  }

  return {
    ...node,
    children: node.children.map((child) => updateFlowNode(child, targetId, patcher)),
  }
}

const addFlowChildNode = (
  node: FlowNodeDraft,
  groupId: string,
  nextChild: FlowNodeDraft,
): FlowNodeDraft => {
  if (node.nodeType === 'condition') {
    return node
  }

  if (node.id === groupId) {
    return {
      ...node,
      children: [...node.children, nextChild],
    }
  }

  return {
    ...node,
    children: node.children.map((child) => addFlowChildNode(child, groupId, nextChild)),
  }
}

const removeFlowNode = (
  rootGroup: FlowGroupDraft,
  targetId: string,
): FlowGroupDraft => {
  const removeChildFromGroup = (group: FlowGroupDraft): FlowGroupDraft => {
    const nextChildren = group.children.flatMap<FlowNodeDraft>((child) => {
      if (child.id === targetId) {
        return []
      }

      if (child.nodeType === 'group') {
        return [removeChildFromGroup(child)]
      }

      return [child]
    })

    return {
      ...group,
      children: ensureGroupChildren(nextChildren),
    }
  }

  if (rootGroup.id === targetId) {
    return {
      ...rootGroup,
      children: [createEmptyFlowFilterCondition()],
    }
  }

  return removeChildFromGroup(rootGroup)
}

const updateTransforms = (
  transforms: TransformDraft[],
  targetId: string,
  patch: Partial<TransformDraft>,
): TransformDraft[] =>
  transforms.map((transform) =>
    transform.id === targetId ? { ...transform, ...patch } : transform,
  )

interface FlowNodeEditorProps {
  node: FlowNodeDraft
  depth: number
  readOnly: boolean
  onUpdateNode: (
    targetId: string,
    patcher: (targetNode: FlowNodeDraft) => FlowNodeDraft,
  ) => void
  onAddCondition: (groupId: string) => void
  onAddGroup: (groupId: string) => void
  onRemoveNode: (nodeId: string) => void
}

function FlowNodeEditor({
  node,
  depth,
  readOnly,
  onUpdateNode,
  onAddCondition,
  onAddGroup,
  onRemoveNode,
}: FlowNodeEditorProps) {
  const { t } = useI18n()
  if (node.nodeType === 'condition') {
    return (
      <div
        className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(20,46,36,0.04)]"
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Condition</p>
            <p className="text-[11px] text-muted-foreground">
              {t('model.flowEditor.conditionFields')}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-danger"
            onClick={() => onRemoveNode(node.id)}
            disabled={readOnly}
            aria-label={t('model.flowEditor.conditionDeleteAria')}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">from</label>
            <Select
              value={node.from}
              onValueChange={(next) =>
                onUpdateNode(node.id, (targetNode) =>
                  targetNode.nodeType === 'condition'
                    ? {
                        ...targetNode,
                        from: next as FlowLookupSource,
                      }
                    : targetNode,
                )
              }
              disabled={readOnly}
            >
              <SelectTrigger className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOOKUP_SOURCE_OPTIONS.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">path</label>
            <Input
              value={node.path}
              onChange={(event) =>
                onUpdateNode(node.id, (targetNode) =>
                  targetNode.nodeType === 'condition'
                    ? {
                        ...targetNode,
                        path: event.target.value,
                      }
                    : targetNode,
                )
              }
              placeholder="status"
              readOnly={readOnly}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">comparison</label>
            <Select
              value={node.comparison}
              onValueChange={(next) =>
                onUpdateNode(node.id, (targetNode) =>
                  targetNode.nodeType === 'condition'
                    ? {
                        ...targetNode,
                        comparison: next as FlowComparison,
                      }
                    : targetNode,
                )
              }
              disabled={readOnly}
            >
              <SelectTrigger className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLOW_COMPARISON_OPTIONS.map((comparison) => (
                  <SelectItem key={comparison} value={comparison}>
                    {comparison}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">expected</label>
            <Input
              value={node.expectedText}
              onChange={(event) =>
                onUpdateNode(node.id, (targetNode) =>
                  targetNode.nodeType === 'condition'
                    ? {
                        ...targetNode,
                        expectedText: event.target.value,
                      }
                    : targetNode,
                )
              }
              placeholder={t('common.example', { value: '"PASS", 4, true, ["A", "B"]' })}
              readOnly={readOnly}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-border bg-muted p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">transforms</p>
              <p className="text-[11px] text-muted-foreground">
                {t('model.flowEditor.transformsHint')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onUpdateNode(node.id, (targetNode) =>
                  targetNode.nodeType === 'condition'
                    ? {
                        ...targetNode,
                        transforms: [...targetNode.transforms, createTransformDraft()],
                      }
                    : targetNode,
                )
              }
              disabled={readOnly}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              {t('model.flowEditor.addTransform')}
            </Button>
          </div>

          {node.transforms.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">{t('model.flowEditor.transformsEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {node.transforms.map((transform) => (
                <div key={transform.id} className="flex items-center gap-2">
                  <Input
                    value={transform.value}
                    onChange={(event) =>
                      onUpdateNode(node.id, (targetNode) =>
                        targetNode.nodeType === 'condition'
                          ? {
                              ...targetNode,
                              transforms: updateTransforms(targetNode.transforms, transform.id, {
                                value: event.target.value,
                              }),
                            }
                          : targetNode,
                      )
                    }
                    placeholder="trim"
                    readOnly={readOnly}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      'size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-danger',
                      readOnly ? 'hidden' : null,
                    )}
                    onClick={() =>
                      onUpdateNode(node.id, (targetNode) =>
                        targetNode.nodeType === 'condition'
                          ? {
                              ...targetNode,
                              transforms: targetNode.transforms.filter(
                                (item) => item.id !== transform.id,
                              ),
                            }
                          : targetNode,
                      )
                    }
                    disabled={readOnly}
                    aria-label={t('model.flowEditor.transformDeleteAria')}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border border-border bg-muted p-4"
      style={{ marginLeft: `${depth * 16}px` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">Group</p>
          <p className="text-[11px] text-muted-foreground">
            {t('model.flowEditor.groupCompose2', { groupType: node.groupType })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={node.groupType}
            onValueChange={(next) =>
              onUpdateNode(node.id, (targetNode) =>
                targetNode.nodeType === 'group'
                  ? {
                      ...targetNode,
                      groupType: next as FlowGroupDraft['groupType'],
                    }
                  : targetNode,
              )
            }
            disabled={readOnly}
          >
            <SelectTrigger className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">and</SelectItem>
              <SelectItem value="or">or</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddCondition(node.id)}
            disabled={readOnly}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('model.flowEditor.addCondition')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddGroup(node.id)}
            disabled={readOnly}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('model.flowEditor.addGroup')}
          </Button>
          {depth > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onRemoveNode(node.id)}
              disabled={readOnly}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {node.children.map((childNode) => (
          <FlowNodeEditor
            key={childNode.id}
            node={childNode}
            depth={depth + 1}
            readOnly={readOnly}
            onUpdateNode={onUpdateNode}
            onAddCondition={onAddCondition}
            onAddGroup={onAddGroup}
            onRemoveNode={onRemoveNode}
          />
        ))}
      </div>
    </div>
  )
}
