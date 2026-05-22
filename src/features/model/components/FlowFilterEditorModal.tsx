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
import { cn } from '@/lib/utils'
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
        <DialogHeader className="shrink-0 border-b border-[#EEF3F0] px-6 py-5">
          <DialogTitle>{titleLabel || 'Flow 편집'}</DialogTitle>
          <DialogDescription>
            workflow_filter를 canonical group/condition 구조로 편집합니다.
          </DialogDescription>
        </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
            <div className="flex h-full min-h-0 flex-col gap-3">
              {errorMessage ? (
                <p className="rounded-xl border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-sm text-[#B4483F]">
                  {errorMessage}
                </p>
              ) : null}

              {draft.mode === 'raw' ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <p className="text-sm text-[#C5534B]">
                    현재 값은 structured editor가 안전하게 해석할 수 없어 raw 모드로 유지합니다.
                  </p>
                  <textarea
                    value={draft.rawValue}
                    onChange={(event) =>
                      setDraft((previousDraft) => ({
                        ...previousDraft,
                        rawValue: event.target.value,
                      }))
                    }
                    className="min-h-0 w-full flex-1 resize-none overflow-auto rounded-xl border border-[#DCE5E0] bg-[#FAFCFB] p-3 font-mono text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                    readOnly={readOnly}
                  />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <div className="rounded-2xl border border-[#E4EAE6] bg-[#FAFCFB] px-4 py-3">
                    <p className="text-sm font-semibold text-[#1E3D33]">
                      root group와 하위 condition을 조합해 `and` / `or` 식을 구성합니다.
                    </p>
                    <p className="mt-1 text-xs text-[#738078]">
                      `expected`는 JSON literal 기준으로 입력하면 숫자, boolean, array까지 lossless 하게 저장됩니다.
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

        <DialogFooter className="shrink-0 border-t border-[#EEF3F0] px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          {!readOnly ? <Button onClick={handleSave}>적용</Button> : null}
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
  if (node.nodeType === 'condition') {
    return (
      <div
        className="rounded-2xl border border-[#DCE5E0] bg-white p-4 shadow-[0_1px_2px_rgba(20,46,36,0.04)]"
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[#1E3D33]">Condition</p>
            <p className="text-[11px] text-[#738078]">
              `from`, `path`, `comparison`, `expected`, `transforms`를 직접 편집합니다.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-lg text-[#6A7971] hover:bg-[#F3F7F5] hover:text-[#C5534B]"
            onClick={() => onRemoveNode(node.id)}
            disabled={readOnly}
            aria-label="조건 삭제"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E3D33]">from</label>
            <select
              value={node.from}
              onChange={(event) =>
                onUpdateNode(node.id, (targetNode) =>
                  targetNode.nodeType === 'condition'
                    ? {
                        ...targetNode,
                        from: event.target.value as FlowLookupSource,
                      }
                    : targetNode,
                )
              }
              className="h-9 w-full rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
              disabled={readOnly}
            >
              {LOOKUP_SOURCE_OPTIONS.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E3D33]">path</label>
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
            <label className="text-xs font-semibold text-[#1E3D33]">comparison</label>
            <select
              value={node.comparison}
              onChange={(event) =>
                onUpdateNode(node.id, (targetNode) =>
                  targetNode.nodeType === 'condition'
                    ? {
                        ...targetNode,
                        comparison: event.target.value as FlowComparison,
                      }
                    : targetNode,
                )
              }
              className="h-9 w-full rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
              disabled={readOnly}
            >
              {FLOW_COMPARISON_OPTIONS.map((comparison) => (
                <option key={comparison} value={comparison}>
                  {comparison}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E3D33]">expected</label>
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
              placeholder='예: "PASS", 4, true, ["A", "B"]'
              readOnly={readOnly}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-[#E7EEEA] bg-[#FAFCFB] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#1E3D33]">transforms</p>
              <p className="text-[11px] text-[#738078]">
                순차 적용할 transform을 한 줄씩 추가합니다.
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
              transform 추가
            </Button>
          </div>

          {node.transforms.length === 0 ? (
            <p className="text-[11px] text-[#97A39C]">transform이 없으면 원본 값을 그대로 비교합니다.</p>
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
                      'size-8 rounded-lg text-[#6A7971] hover:bg-[#F3F7F5] hover:text-[#C5534B]',
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
                    aria-label="transform 삭제"
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
      className="rounded-2xl border border-[#D6E4DD] bg-[#F8FBF9] p-4"
      style={{ marginLeft: `${depth * 16}px` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#1E3D33]">Group</p>
          <p className="text-[11px] text-[#738078]">
            하위 조건을 `{node.groupType}` 기준으로 묶습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={node.groupType}
            onChange={(event) =>
              onUpdateNode(node.id, (targetNode) =>
                targetNode.nodeType === 'group'
                  ? {
                      ...targetNode,
                      groupType: event.target.value as FlowGroupDraft['groupType'],
                    }
                  : targetNode,
              )
            }
            className="h-9 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
            disabled={readOnly}
          >
            <option value="and">and</option>
            <option value="or">or</option>
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddCondition(node.id)}
            disabled={readOnly}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            조건 추가
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAddGroup(node.id)}
            disabled={readOnly}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            그룹 추가
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
