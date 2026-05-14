import { memo, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useModelNodeDetail } from '../hooks/useModelNodeDetail'
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  buildActionDataIndexValue,
  buildWorkflowFilterValue,
  createEmptyActionDataIndexField,
  createEmptyWorkflowFilterCondition,
  createEmptyWorkflowGroup,
  createTransformDraft,
  LOOKUP_SOURCE_OPTIONS,
  parseActionDataIndexEditor,
  parseWorkflowFilterEditor,
  summarizeActionDataIndexValue,
  summarizeWorkflowFilterValue,
  type ActionDataIndexEditorDraft,
  type ActionDataIndexFieldDraft,
  type TransformDraft,
  type WorkflowComparison,
  type WorkflowFilterEditorDraft,
  type WorkflowGroupDraft,
  type WorkflowLookupSource,
  type WorkflowNodeDraft,
  WORKFLOW_COMPARISON_OPTIONS,
} from '../lib/model-detail-editor'
import { extractMdfMessageOptions, type MdfMessageOption } from '../lib/mdf-message-parser'
import {
  MODEL_DETAIL_NODE_LABELS,
  SECS_DETAIL_NODES,
  SOCKET_DETAIL_NODES,
  type ModelDetailNode,
  type ModelDetailRow,
  type ModelMdfContent,
  type ModelInfo,
  type ModelOpenedTab,
} from '../types/model.types'

const WORKFLOW_MODAL_EDITABLE_COLUMNS = new Set(['filter', 'data index'])
const EMPTY_MDF_TEMPLATE_VALUE = '__empty__'

/**
 * 모든 model 상세 테이블이 동일한 가시 프레임을 유지하도록 공통 최소 폭을 강제합니다.
 * 내용이 길어도 바깥 패널이 아니라 테이블 viewport 내부에서만 스크롤되도록 고정합니다.
 */
const MODEL_DETAIL_TABLE_CLASS = 'min-w-max table-auto'
const MODEL_DETAIL_TEXT_FIELD_MIN_WIDTH_CH = 26
const MODEL_DETAIL_TEXT_FIELD_PADDING_CH = 14
const MODEL_DETAIL_MODAL_PREVIEW_WIDTH = '180px'

interface WorkflowTextEditorState {
  rowId: string
  rowLabel: string
  rowIndex: number
  columnIndex: number
  columnName: string
}

interface WorkflowMessageOption {
  value: string
  label: string
}

interface ModelDetailPanelProps {
  openedTabs: ModelOpenedTab[]
  activeTab: number | null
  activeModel: ModelInfo | null
  detailNode: ModelDetailNode | null
  detailColumns: string[]
  detailRows: ModelDetailRow[]
  mdfContents: ModelMdfContent[]
  workflowMdfContents: ModelMdfContent[]
  isDetailLoading: boolean
  detailErrorMessage: string | null
  isEditMode: boolean
  isLockedByOtherUser: boolean
  lockOwner: string | null
  isCheckoutPending: boolean
  isCheckinPending: boolean
  isDetailSavePending: boolean
  isMdfUploadPending: boolean
  actionErrorMessage: string | null
  onSelectTab: (modelVersionKey: number) => void
  onCloseTab: (modelVersionKey: number) => void
  onSelectDetailNode: (node: ModelDetailNode) => void
  onChangeDetailValue: (rowId: string, columnIndex: number, nextValue: string) => void
  onAddDetailRow: () => void
  onDeleteDetailRow: (rowId: string) => void
  onSaveDetailRows: () => void
  onUndo: () => void
  onUploadMdf: (file: File) => void
  onCheckOut: () => void
  onRequestCheckIn: () => void
}

/**
 * 통신 인터페이스에 맞는 상세 노드 집합을 반환합니다.
 */
const resolveDetailNodes = (model: ModelInfo | null): ModelDetailNode[] => {
  if (!model) {
    return []
  }

  const normalizedInterface = model.commInterface.toUpperCase()
  return normalizedInterface === 'SOCKET' ? SOCKET_DETAIL_NODES : SECS_DETAIL_NODES
}

/**
 * workflow의 Filter/Data Index 컬럼은 구조화 편집 대상으로 분기합니다.
 */
const isWorkflowModalEditableColumn = (
  detailNode: ModelDetailNode | null,
  columnName: string | undefined,
): boolean => {
  if (detailNode !== 'workflow' || !columnName) {
    return false
  }

  return WORKFLOW_MODAL_EDITABLE_COLUMNS.has(columnName.trim().toLowerCase())
}

const isFilterColumn = (columnName: string | undefined): boolean =>
  (columnName ?? '').trim().toLowerCase() === 'filter'

const isDataIndexColumn = (columnName: string | undefined): boolean =>
  (columnName ?? '').trim().toLowerCase() === 'data index'

const isMessageNameColumn = (columnName: string | undefined): boolean =>
  (columnName ?? '').trim().toLowerCase() === 'message name'

const isEventIdColumn = (columnName: string | undefined): boolean =>
  (columnName ?? '').trim().toLowerCase() === 'eventid'

const isDcopWorkflowNameColumn = (columnName: string | undefined): boolean =>
  (columnName ?? '').trim() === 'Workflow Name'

const isDcopCollectionRuleColumn = (columnName: string | undefined): boolean =>
  (columnName ?? '').trim() === 'Collection Rule'

/** dcop-itemes의 Collection Rule 선택 옵션 (기본값: LAST) */
const DCOP_COLLECTION_RULE_OPTIONS = ['LAST', 'FIRST', 'AVERAGE', 'MIN', 'MAX'] as const

/**
 * workflow 테이블에서 Workflow Name(첫 번째 컬럼) 입력값이 다른 행에 중복되는지 확인합니다.
 *
 * @param value 현재 입력값
 * @param rowId 현재 row의 id (자기 자신 제외용)
 * @param allRows 전체 row 목록
 * @returns 중복이 있으면 true
 */
const hasDuplicateWorkflowName = (value: string, rowId: string, allRows: ModelDetailRow[]): boolean => {
  const normalized = value.trim()
  if (!normalized) {
    return false
  }
  return allRows.some((other) => other.id !== rowId && (other.values[0] ?? '').trim() === normalized)
}

const resolveWorkflowPreviewValue = (row: ModelDetailRow, columnIndex: number, columnName: string): string => {
  const storedPreview = row.previewValues[columnIndex]?.trim()
  if (storedPreview) {
    return storedPreview
  }

  const rawValue = row.values[columnIndex] ?? ''
  if (isFilterColumn(columnName)) {
    return summarizeWorkflowFilterValue(rawValue)
  }

  if (isDataIndexColumn(columnName)) {
    return summarizeActionDataIndexValue(rawValue)
  }

  return rawValue
}

const updateActionDataIndexDraftRow = (
  rows: ActionDataIndexFieldDraft[],
  targetId: string,
  patch: Partial<ActionDataIndexFieldDraft>,
): ActionDataIndexFieldDraft[] =>
  rows.map((row) => (row.id === targetId ? { ...row, ...patch } : row))

const moveActionDataIndexDraftRow = (
  rows: ActionDataIndexFieldDraft[],
  sourceId: string,
  targetIndex: number,
): ActionDataIndexFieldDraft[] => {
  const sourceIndex = rows.findIndex((row) => row.id === sourceId)
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= rows.length ||
    sourceIndex === targetIndex
  ) {
    return rows
  }

  const nextRows = [...rows]
  const [movedRow] = nextRows.splice(sourceIndex, 1)
  nextRows.splice(targetIndex, 0, movedRow)
  return nextRows
}

const updateTransforms = (
  transforms: TransformDraft[],
  targetId: string,
  patch: Partial<TransformDraft>,
): TransformDraft[] =>
  transforms.map((transform) =>
    transform.id === targetId ? { ...transform, ...patch } : transform,
  )

const ensureGroupChildren = (children: WorkflowNodeDraft[]): WorkflowNodeDraft[] =>
  children.length > 0 ? children : [createEmptyWorkflowFilterCondition()]

const updateWorkflowNode = (
  node: WorkflowNodeDraft,
  targetId: string,
  patcher: (targetNode: WorkflowNodeDraft) => WorkflowNodeDraft,
): WorkflowNodeDraft => {
  if (node.id === targetId) {
    return patcher(node)
  }

  if (node.nodeType === 'condition') {
    return node
  }

  return {
    ...node,
    children: node.children.map((child) => updateWorkflowNode(child, targetId, patcher)),
  }
}

const addWorkflowChildNode = (
  node: WorkflowNodeDraft,
  groupId: string,
  nextChild: WorkflowNodeDraft,
): WorkflowNodeDraft => {
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
    children: node.children.map((child) => addWorkflowChildNode(child, groupId, nextChild)),
  }
}

const removeWorkflowNode = (
  rootGroup: WorkflowGroupDraft,
  targetId: string,
): WorkflowGroupDraft => {
  const removeChildFromGroup = (group: WorkflowGroupDraft): WorkflowGroupDraft => {
    const nextChildren = group.children.flatMap<WorkflowNodeDraft>((child) => {
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
      children: [createEmptyWorkflowFilterCondition()],
    }
  }

  return removeChildFromGroup(rootGroup)
}

const buildMdfMessageOptions = (
  workflowMdfContents: ModelMdfContent[],
  currentValue: string,
): MdfMessageOption[] => {
  const optionMap = new Map<string, MdfMessageOption>()
  extractMdfMessageOptions(workflowMdfContents).forEach((option) => {
    optionMap.set(option.messageName, option)
  })

  const normalizedCurrentValue = currentValue.trim()
  if (normalizedCurrentValue && !optionMap.has(normalizedCurrentValue)) {
    optionMap.set(normalizedCurrentValue, {
      messageName: normalizedCurrentValue,
      sourceName: '',
      xmlSnippet: '',
      targetType: null,
      outputType: null,
    })
  }

  return [...optionMap.values()]
}

interface WorkflowNodeEditorProps {
  node: WorkflowNodeDraft
  depth: number
  readOnly: boolean
  onUpdateNode: (
    targetId: string,
    patcher: (targetNode: WorkflowNodeDraft) => WorkflowNodeDraft,
  ) => void
  onAddCondition: (groupId: string) => void
  onAddGroup: (groupId: string) => void
  onRemoveNode: (nodeId: string) => void
}

function WorkflowNodeEditor({
  node,
  depth,
  readOnly,
  onUpdateNode,
  onAddCondition,
  onAddGroup,
  onRemoveNode,
}: WorkflowNodeEditorProps) {
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
                        from: event.target.value as WorkflowLookupSource,
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
                        comparison: event.target.value as WorkflowComparison,
                      }
                    : targetNode,
                )
              }
              className="h-9 w-full rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
              disabled={readOnly}
            >
              {WORKFLOW_COMPARISON_OPTIONS.map((comparison) => (
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
                      groupType: event.target.value as WorkflowGroupDraft['groupType'],
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
          <WorkflowNodeEditor
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

/**
 * Model Version 상세 패널입니다.
 */
export const ModelDetailPanel = memo(function ModelDetailPanel({
  openedTabs,
  activeTab,
  activeModel,
  detailNode,
  detailColumns,
  detailRows,
  mdfContents,
  workflowMdfContents,
  isDetailLoading,
  detailErrorMessage,
  isEditMode,
  isLockedByOtherUser,
  lockOwner,
  isCheckoutPending,
  isCheckinPending,
  isDetailSavePending,
  isMdfUploadPending,
  actionErrorMessage,
  onSelectTab,
  onCloseTab,
  onSelectDetailNode,
  onChangeDetailValue,
  onAddDetailRow,
  onDeleteDetailRow,
  onSaveDetailRows,
  onUndo,
  onUploadMdf,
  onCheckOut,
  onRequestCheckIn,
}: ModelDetailPanelProps) {
  const [workflowTextEditor, setWorkflowTextEditor] = useState<WorkflowTextEditorState | null>(null)
  const [workflowFilterDraft, setWorkflowFilterDraft] = useState<WorkflowFilterEditorDraft>(() =>
    parseWorkflowFilterEditor(''),
  )
  const [actionDataIndexDraft, setActionDataIndexDraft] = useState<ActionDataIndexEditorDraft>(() =>
    parseActionDataIndexEditor(''),
  )
  const [draggingActionDataIndexFieldId, setDraggingActionDataIndexFieldId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const detailNodes = resolveDetailNodes(activeModel)
  const normalizedDetailNode = detailNode ?? detailNodes[0] ?? null
  const normalizedDetailColumns = detailColumns.length > 0 ? detailColumns : ['Value']
  const isMdfNode = normalizedDetailNode === 'mdf'
  const isWorkflowNode = normalizedDetailNode === 'workflow'
  const isDcopItemsNode = normalizedDetailNode === 'dcop-itemes'
  const isBranchModel = Boolean(activeModel?.parentModel?.trim())
  const isDeprecatedBranch =
    isBranchModel && activeModel?.status.trim().toUpperCase() === 'DEPRECATED'
  const isReadOnly = !isEditMode || isLockedByOtherUser
  const isWorkflowEditorOpen = workflowTextEditor !== null && normalizedDetailNode === 'workflow'
  const canEditTableRows = !isReadOnly && !isMdfNode

  // SOCKET 모델 여부 판단
  const isSocketModel = activeModel?.commInterface?.toUpperCase() === 'SOCKET'

  // workflow 편집 시 Message Name 정합성을 위해 secs-message / socket-message 데이터를 조회합니다.
  // (읽기 전용 상태에서는 불필요하므로 edit 모드일 때만 활성화)
  const workflowMessageDetailNode = isSocketModel ? 'socket-message' : 'secs-message'
  const workflowMessageQuery = useModelNodeDetail(
    isWorkflowNode && !isReadOnly ? (activeModel?.modelVersionKey ?? null) : null,
    workflowMessageDetailNode,
  )
  // message 이름 컬럼은 첫 번째 컬럼 ('SECS Message Name' 또는 'Socket Message Name')
  const workflowMessageOptions = useMemo(
    () => workflowMessageQuery.data?.rows.map((row) => row.values[0] ?? '').filter(Boolean) ?? [],
    [workflowMessageQuery.data?.rows],
  )

  // workflow 편집 시 MES Message Name도 포함합니다. (SECS/Socket 모델 공통 적용)
  const mesMessageQuery = useModelNodeDetail(
    isWorkflowNode && !isReadOnly ? (activeModel?.modelVersionKey ?? null) : null,
    'mes-message',
  )
  const mesMessageOptions = useMemo(
    () => mesMessageQuery.data?.rows.map((row) => row.values[0] ?? '').filter(Boolean) ?? [],
    [mesMessageQuery.data?.rows],
  )
  // 동일 message 이름이 여러 출처에 있으면 저장값은 그대로 두고 라벨만 병합해 보여 줍니다.
  const allMessageOptions = useMemo<WorkflowMessageOption[]>(() => {
    const sortedWorkflowMessageOptions = [...workflowMessageOptions].sort((firstItem, secondItem) =>
      firstItem.localeCompare(secondItem),
    )
    const sortedMesMessageOptions = [...mesMessageOptions].sort((firstItem, secondItem) =>
      firstItem.localeCompare(secondItem),
    )
    const sourceSetByName = new Map<string, Set<string>>()

    sortedWorkflowMessageOptions.forEach((messageName) => {
      const existingSourceSet = sourceSetByName.get(messageName) ?? new Set<string>()
      existingSourceSet.add(isSocketModel ? 'Socket Message' : 'SECS Message')
      sourceSetByName.set(messageName, existingSourceSet)
    })

    sortedMesMessageOptions.forEach((messageName) => {
      const existingSourceSet = sourceSetByName.get(messageName) ?? new Set<string>()
      existingSourceSet.add('MES Message')
      sourceSetByName.set(messageName, existingSourceSet)
    })

    return [...sourceSetByName.entries()].map(([value, sourceSet]) => ({
      value,
      label: `${value} [${[...sourceSet].join(', ')}]`,
    }))
  }, [isSocketModel, mesMessageOptions, workflowMessageOptions])

  // SECS 모델 workflow / dcop-itemes 편집 시 EventId 정합성을 위해 eventides 데이터를 조회합니다.
  // (SOCKET 모델이거나 읽기 전용 상태에서는 조회하지 않음)
  const workflowEventIdQuery = useModelNodeDetail(
    (isWorkflowNode || isDcopItemsNode) && !isReadOnly && !isSocketModel
      ? (activeModel?.modelVersionKey ?? null)
      : null,
    'eventides',
  )
  // EventId 컬럼은 eventides의 첫 번째 컬럼
  const workflowEventIdOptions = useMemo(
    () => workflowEventIdQuery.data?.rows.map((row) => row.values[0] ?? '').filter(Boolean) ?? [],
    [workflowEventIdQuery.data?.rows],
  )

  // dcop-itemes 편집 시 Workflow Name 정합성을 위해 workflow 데이터를 조회합니다.
  // (읽기 전용 상태에서는 불필요하므로 edit 모드일 때만 활성화)
  const dcopWorkflowQuery = useModelNodeDetail(
    isDcopItemsNode && !isReadOnly ? (activeModel?.modelVersionKey ?? null) : null,
    'workflow',
  )
  // Workflow Name 컬럼은 workflow의 첫 번째 컬럼
  const dcopWorkflowNameOptions = useMemo(
    () => dcopWorkflowQuery.data?.rows.map((row) => row.values[0] ?? '').filter(Boolean) ?? [],
    [dcopWorkflowQuery.data?.rows],
  )

  const hintText = !activeModel
    ? '모델을 선택해 주세요.'
    : !isBranchModel
      ? 'Root model은 항상 읽기 전용입니다.'
      : isDeprecatedBranch
        ? 'DEPRECATED branch는 읽기 전용입니다.'
        : isReadOnly
          ? '읽기 전용입니다. 수정하려면 Check Out이 필요합니다.'
          : '편집 중입니다. Save로 저장하고 Check In으로 확정할 수 있습니다.'

  const checkoutDisabled =
    !activeModel ||
    !isBranchModel ||
    isDeprecatedBranch ||
    isCheckoutPending ||
    isLockedByOtherUser
  const checkinDisabled =
    !activeModel ||
    !isBranchModel ||
    isCheckinPending ||
    !isEditMode ||
    isLockedByOtherUser
  // workflow 노드에서 Workflow Name 중복이 있으면 저장을 차단합니다.
  const hasWorkflowNameDuplicate = useMemo(() => {
    if (!isWorkflowNode) {
      return false
    }
    const names = detailRows.map((row) => (row.values[0] ?? '').trim()).filter(Boolean)
    return names.length !== new Set(names).size
  }, [isWorkflowNode, detailRows])

  const detailColumnWidths = normalizedDetailColumns.map((columnName, columnIndex) => {
    if (isWorkflowModalEditableColumn(normalizedDetailNode, columnName)) {
      return MODEL_DETAIL_MODAL_PREVIEW_WIDTH
    }

    const maxValueLength = detailRows.reduce((maxLength, row) => {
      const rawValue = row.values[columnIndex] ?? ''
      const displayValue =
        isWorkflowNode && isMessageNameColumn(columnName)
          ? (allMessageOptions.find((option) => option.value === rawValue)?.label ?? rawValue)
          : rawValue

      return Math.max(maxLength, displayValue.length)
    }, columnName.length)

    return `${Math.max(
      maxValueLength + MODEL_DETAIL_TEXT_FIELD_PADDING_CH,
      MODEL_DETAIL_TEXT_FIELD_MIN_WIDTH_CH,
    )}ch`
  })

  const saveDisabled =
    isDetailLoading ||
    isDetailSavePending ||
    !isEditMode ||
    isLockedByOtherUser ||
    isMdfNode ||
    hasWorkflowNameDuplicate

  const workflowEditorTitle = useMemo(() => {
    if (!workflowTextEditor) {
      return ''
    }

    if (!workflowTextEditor.rowLabel) {
      return workflowTextEditor.columnName
    }

    return `${workflowTextEditor.rowLabel} / ${workflowTextEditor.columnName}`
  }, [workflowTextEditor])

  const workflowEditorErrorMessage = useMemo(() => {
    if (!workflowTextEditor || !actionErrorMessage) {
      return null
    }

    const normalizedMessage = actionErrorMessage.trim()
    if (!normalizedMessage.startsWith('workflow ')) {
      return normalizedMessage
    }

    const rowPrefix = `workflow ${workflowTextEditor.rowIndex + 1}행`
    return normalizedMessage.startsWith(rowPrefix) ? normalizedMessage : null
  }, [actionErrorMessage, workflowTextEditor])

  const workflowMdfMessageOptions = useMemo(
    () => buildMdfMessageOptions(workflowMdfContents, actionDataIndexDraft.mdfTemplateName),
    [actionDataIndexDraft.mdfTemplateName, workflowMdfContents],
  )
  const selectedWorkflowMdfMessage = useMemo(
    () =>
      workflowMdfMessageOptions.find(
        (option) => option.messageName === actionDataIndexDraft.mdfTemplateName.trim(),
      ) ?? null,
    [actionDataIndexDraft.mdfTemplateName, workflowMdfMessageOptions],
  )

  const handleUpdateWorkflowNode = (
    targetId: string,
    patcher: (targetNode: WorkflowNodeDraft) => WorkflowNodeDraft,
  ) => {
    setWorkflowFilterDraft((previousDraft) => ({
      ...previousDraft,
      rootGroup: updateWorkflowNode(previousDraft.rootGroup, targetId, patcher) as WorkflowGroupDraft,
    }))
  }

  const handleAddWorkflowCondition = (groupId: string) => {
    setWorkflowFilterDraft((previousDraft) => ({
      ...previousDraft,
      rootGroup: addWorkflowChildNode(
        previousDraft.rootGroup,
        groupId,
        createEmptyWorkflowFilterCondition(),
      ) as WorkflowGroupDraft,
    }))
  }

  const handleAddWorkflowGroup = (groupId: string) => {
    setWorkflowFilterDraft((previousDraft) => ({
      ...previousDraft,
      rootGroup: addWorkflowChildNode(
        previousDraft.rootGroup,
        groupId,
        createEmptyWorkflowGroup('and'),
      ) as WorkflowGroupDraft,
    }))
  }

  const handleRemoveWorkflowNode = (nodeId: string) => {
    setWorkflowFilterDraft((previousDraft) => ({
      ...previousDraft,
      rootGroup: removeWorkflowNode(previousDraft.rootGroup, nodeId),
    }))
  }

  const handleOpenWorkflowTextEditor = (
    row: ModelDetailRow,
    rowIndex: number,
    columnIndex: number,
  ) => {
    const columnName = normalizedDetailColumns[columnIndex]
    if (!isWorkflowModalEditableColumn(normalizedDetailNode, columnName)) {
      return
    }

    const value = row.values[columnIndex] ?? ''
    setWorkflowTextEditor({
      rowId: row.id,
      rowLabel: row.values[0] ?? '',
      rowIndex,
      columnIndex,
      columnName,
    })

    if (isFilterColumn(columnName)) {
      setWorkflowFilterDraft(parseWorkflowFilterEditor(value))
    } else {
      setActionDataIndexDraft(parseActionDataIndexEditor(value))
    }
  }

  const handleCloseWorkflowTextEditor = () => {
    setWorkflowTextEditor(null)
    setDraggingActionDataIndexFieldId(null)
  }

  const handleSaveWorkflowTextEditor = () => {
    if (!workflowTextEditor || isReadOnly) {
      return
    }

    const nextValue = isFilterColumn(workflowTextEditor.columnName)
      ? buildWorkflowFilterValue(workflowFilterDraft)
      : buildActionDataIndexValue(actionDataIndexDraft)

    onChangeDetailValue(workflowTextEditor.rowId, workflowTextEditor.columnIndex, nextValue)
    handleCloseWorkflowTextEditor()
  }

  const handleMoveActionDataIndexField = (fieldId: string, targetIndex: number) => {
    if (isReadOnly) {
      return
    }

    setActionDataIndexDraft((previousDraft) => ({
      ...previousDraft,
      fields: moveActionDataIndexDraftRow(previousDraft.fields, fieldId, targetIndex),
    }))
  }

  const handleActionDataIndexFieldDragStart = (
    event: DragEvent<HTMLButtonElement>,
    fieldId: string,
  ) => {
    if (isReadOnly) {
      event.preventDefault()
      return
    }

    setDraggingActionDataIndexFieldId(fieldId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', fieldId)
  }

  const handleActionDataIndexFieldDragOver = (
    event: DragEvent<HTMLTableRowElement>,
    targetFieldId: string,
  ) => {
    if (isReadOnly || !draggingActionDataIndexFieldId || draggingActionDataIndexFieldId === targetFieldId) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleActionDataIndexFieldDrop = (
    event: DragEvent<HTMLTableRowElement>,
    targetFieldId: string,
  ) => {
    if (isReadOnly) {
      return
    }

    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || draggingActionDataIndexFieldId
    if (!sourceId || sourceId === targetFieldId) {
      setDraggingActionDataIndexFieldId(null)
      return
    }

    setActionDataIndexDraft((previousDraft) => {
      const targetIndex = previousDraft.fields.findIndex((field) => field.id === targetFieldId)
      return {
        ...previousDraft,
        fields: moveActionDataIndexDraftRow(previousDraft.fields, sourceId, targetIndex),
      }
    })
    setDraggingActionDataIndexFieldId(null)
  }

  const handleActionDataIndexFieldDragEnd = () => {
    setDraggingActionDataIndexFieldId(null)
  }

  const handleTriggerUpload = () => {
    if (isReadOnly || !isMdfNode) {
      return
    }
    fileInputRef.current?.click()
  }

  const handleUploadFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      onUploadMdf(selectedFile)
    }
    event.target.value = ''
  }

  return (
    <>
      <section
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E4EAE6] bg-white p-4',
          isEditMode && !isLockedByOtherUser ? 'border-[#7C9082]' : null,
        )}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
            {openedTabs.length === 0 ? (
              <span className="text-xs text-[#8A8A8A]">더블 클릭으로 열린 모델 탭이 없습니다.</span>
            ) : (
              openedTabs.map((tab) => (
                <div
                  key={tab.modelVersionKey}
                  className={cn(
                    'flex shrink-0 items-center rounded-lg border',
                    activeTab === tab.modelVersionKey
                      ? 'border-[#7C9082] bg-[#EEF4F0] text-[#1E3D33]'
                      : 'border-[#DCE5E0] bg-white text-[#5B6962] hover:bg-[#F3F7F5]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTab(tab.modelVersionKey)}
                    className="px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                  >
                    {tab.modelName} / {tab.modelVersion}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onCloseTab(tab.modelVersionKey)
                    }}
                    className={cn(
                      'mr-1 inline-flex size-6 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
                      activeTab === tab.modelVersionKey
                        ? 'text-[#365447] hover:bg-[#DCE9E2]'
                        : 'text-[#7B8882] hover:bg-[#E8EFEB]',
                    )}
                    aria-label={`${tab.modelName} ${tab.modelVersion} 탭 닫기`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {isBranchModel && isEditMode ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-[10px] border-[#B8C9C1] bg-[#F3F7F5] px-3 text-xs font-semibold text-[#1E3D33]"
                onClick={onUndo}
                disabled={isDetailSavePending || isCheckinPending || isMdfUploadPending}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Undo
              </Button>
              {isMdfNode ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-[10px] border-[#B8C9C1] bg-[#F3F7F5] px-3 text-xs font-semibold text-[#1E3D33]"
                  onClick={handleTriggerUpload}
                  disabled={isMdfUploadPending || isLockedByOtherUser}
                >
                  {isMdfUploadPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="size-3.5" aria-hidden="true" />
                  )}
                  Upload
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-[10px] border-[#B8C9C1] bg-[#F3F7F5] px-3 text-xs font-semibold text-[#1E3D33]"
                    onClick={onSaveDetailRows}
                    disabled={saveDisabled}
                  >
                    {isDetailSavePending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    Save
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-[10px] border-[#B8C9C1] bg-[#F3F7F5] px-3 text-xs font-semibold text-[#1E3D33]"
                onClick={onRequestCheckIn}
                disabled={checkinDisabled}
              >
                {isCheckinPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                Check In
              </Button>
            </div>
          ) : isBranchModel ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-[10px] border-[#B8C9C1] bg-[#F3F7F5] px-3 text-xs font-semibold text-[#1E3D33]"
              onClick={onCheckOut}
              disabled={checkoutDisabled}
            >
              {isCheckoutPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              Check Out
            </Button>
          ) : null}
        </div>

        <div className="mb-3 text-xs">
          <span className={cn(isReadOnly ? 'text-[#8A8A8A]' : 'font-medium text-[#7C9082]')}>
            {hintText}
          </span>
        </div>

        {isBranchModel && isLockedByOtherUser ? (
          <p className="mb-3 text-xs text-[#C5534B]">
            {lockOwner
              ? `${lockOwner}님이 EDIT 모델을 점유하고 있어 수정할 수 없습니다.`
              : '다른 사용자가 EDIT 모델을 점유하고 있어 수정할 수 없습니다.'}
          </p>
        ) : null}

        {actionErrorMessage ? (
          <p className="mb-3 text-xs text-[#C5534B]">{actionErrorMessage}</p>
        ) : null}

        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[#E4EAE6]">
          <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#E4EAE6] bg-[#FAFCFB] p-2">
            {detailNodes.map((node) => (
              <button
                key={node}
                type="button"
                onClick={() => onSelectDetailNode(node)}
                className={cn(
                  'rounded-md px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
                  normalizedDetailNode === node
                    ? 'bg-[#EAF5EE] font-semibold text-[#1F2D26]'
                    : 'text-[#51605A] hover:bg-[#F1F6F3]',
                )}
              >
                {MODEL_DETAIL_NODE_LABELS[node]}
              </button>
            ))}
          </aside>

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-3">
            {isMdfNode ? (
              <div className="flex h-full min-h-0 flex-col">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  className="hidden"
                  onChange={handleUploadFileChange}
                />

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-1">
                  {isDetailLoading ? (
                    <p className="text-sm text-[#647169]">MDF 데이터를 불러오는 중입니다.</p>
                  ) : null}

                  {detailErrorMessage ? (
                    <p className="text-sm text-[#C5534B]">{detailErrorMessage}</p>
                  ) : null}

                  {!isDetailLoading && !detailErrorMessage && mdfContents.length === 0 ? (
                    <p className="text-sm text-[#647169]">표시할 MDF 데이터가 없습니다.</p>
                  ) : null}

                  {mdfContents.map((content) => (
                    <div
                      key={content.id}
                      className={cn(
                        'flex min-h-0 flex-col space-y-1',
                        mdfContents.length === 1 ? 'flex-1' : null,
                      )}
                    >
                      <p className="text-xs font-medium text-[#44544D]">{`DEFAULT: ${content.name || 'MDF'}`}</p>
                      <textarea
                        readOnly
                        value={content.xml}
                        className="min-h-0 w-full flex-1 resize-none rounded-lg border border-[#DCE5E0] bg-[#FAFCFB] p-3 font-mono text-xs text-[#22322B] focus-visible:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#213028]">
                    {MODEL_DETAIL_NODE_LABELS[normalizedDetailNode ?? 'model-parameter']}
                  </h2>

                  {canEditTableRows ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-[10px] border-[#B8C9C1] bg-[#F3F7F5] px-3 text-xs font-semibold text-[#1E3D33]"
                      onClick={onAddDetailRow}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      행 추가
                    </Button>
                  ) : null}
                </div>

                <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                  <Table className={MODEL_DETAIL_TABLE_CLASS}>
                    <colgroup>
                      {normalizedDetailColumns.map((columnName, columnIndex) => {
                        const isModalEditableColumn = isWorkflowModalEditableColumn(
                          normalizedDetailNode,
                          columnName,
                        )
                        const columnWidth = detailColumnWidths[columnIndex]

                        return (
                          <col
                            key={columnName}
                            style={{
                              width: columnWidth,
                              minWidth: columnWidth,
                              maxWidth: isModalEditableColumn ? columnWidth : undefined,
                            }}
                          />
                        )
                      })}
                      {canEditTableRows ? <col style={{ width: '92px', minWidth: '92px' }} /> : null}
                    </colgroup>
                    <TableHeader>
                        <TableRow className="bg-[#F6F9F7]">
                        {normalizedDetailColumns.map((columnName, columnIndex) => (
                          <TableHead
                            key={columnName}
                            className={cn(
                              'whitespace-nowrap',
                              columnIndex === 0
                                ? 'sticky left-0 z-30 bg-[#F6F9F7] shadow-[4px_0_8px_-8px_rgba(20,46,36,0.6)]'
                                : null,
                            )}
                            style={{
                              width: detailColumnWidths[columnIndex],
                              minWidth: detailColumnWidths[columnIndex],
                              maxWidth: isWorkflowModalEditableColumn(normalizedDetailNode, columnName)
                                ? detailColumnWidths[columnIndex]
                                : undefined,
                              ...(columnIndex === 0
                                ? {
                                    left: 0,
                                    position: 'sticky',
                                    top: 0,
                                    zIndex: 40,
                                  }
                                : {}),
                            }}
                          >
                            {columnName}
                          </TableHead>
                        ))}
                        {canEditTableRows ? <TableHead className="w-[92px] whitespace-nowrap">작업</TableHead> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isDetailLoading ? (
                        Array.from({ length: 8 }).map((_, rowIndex) => (
                          <TableRow key={`model-detail-skeleton-${rowIndex}`} data-testid="model-detail-skeleton">
                            {Array.from({ length: normalizedDetailColumns.length + (canEditTableRows ? 1 : 0) }).map((_, cellIndex) => (
                              <TableCell key={cellIndex}>
                                <Skeleton className="h-4 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : detailErrorMessage ? (
                        <TableRow>
                          <TableCell
                            colSpan={normalizedDetailColumns.length + (canEditTableRows ? 1 : 0)}
                            className="py-10 text-center text-sm text-[#C5534B]"
                          >
                            {detailErrorMessage}
                          </TableCell>
                        </TableRow>
                      ) : detailRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={normalizedDetailColumns.length + (canEditTableRows ? 1 : 0)}
                            className="py-10 text-center text-sm text-[#647169]"
                          >
                            {canEditTableRows
                              ? '편집 중인 상세 데이터가 없습니다. 행 추가로 row를 추가하거나 Undo로 체크아웃을 취소해 주세요.'
                              : '표시할 상세 데이터가 없습니다.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        detailRows.map((row, rowIndex) => (
                          <TableRow key={row.id}>
                            {normalizedDetailColumns.map((columnName, columnIndex) => {
                              const rawValue = row.values[columnIndex] ?? ''
                              const isModalEditable = isWorkflowModalEditableColumn(
                                normalizedDetailNode,
                                columnName,
                              )
                              const displayValue = isModalEditable
                                ? resolveWorkflowPreviewValue(row, columnIndex, columnName)
                                : rawValue

                              // Workflow Name 중복 여부 (workflow 노드의 첫 번째 컬럼)
                              const isDuplicate =
                                isWorkflowNode &&
                                columnIndex === 0 &&
                                hasDuplicateWorkflowName(rawValue, row.id, detailRows)

                              return (
                                <TableCell
                                  key={`${row.id}-${columnIndex}`}
                                  className={cn(
                                    columnIndex === 0
                                      ? 'sticky left-0 z-20 bg-white shadow-[4px_0_8px_-8px_rgba(20,46,36,0.6)]'
                                      : null,
                                    isModalEditable
                                      ? 'overflow-hidden'
                                      : 'whitespace-nowrap',
                                  )}
                                  style={{
                                    width: detailColumnWidths[columnIndex],
                                    minWidth: detailColumnWidths[columnIndex],
                                    maxWidth: isModalEditable
                                      ? detailColumnWidths[columnIndex]
                                      : undefined,
                                    ...(columnIndex === 0
                                      ? {
                                          left: 0,
                                          position: 'sticky',
                                          zIndex: 20,
                                        }
                                      : {}),
                                  }}
                                >
                                  {isModalEditable ? (
                                    <div
                                      className="group flex min-h-8 w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-md border border-[#DCE5E0] bg-white px-2 py-1.5"
                                      onDoubleClick={() =>
                                        handleOpenWorkflowTextEditor(row, rowIndex, columnIndex)
                                      }
                                    >
                                      <span
                                        className={cn(
                                          'min-w-0 flex-1 text-sm text-[#22322B]',
                                          displayValue ? 'truncate' : 'text-[#8A8A8A]',
                                        )}
                                        title={displayValue || rawValue}
                                      >
                                        {displayValue || '—'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenWorkflowTextEditor(row, rowIndex, columnIndex)
                                        }
                                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-[#5B6962] transition hover:border-[#DCE5E0] hover:bg-[#F3F7F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                                        aria-label={`${row.values[0] ?? 'workflow'} ${columnName} 편집`}
                                      >
                                        <MoreHorizontal className="size-3.5" />
                                      </button>
                                    </div>
                                  ) : isReadOnly ? (
                                    <span
                                      className={cn(
                                        'inline-block whitespace-nowrap text-sm text-[#22322B]',
                                        displayValue ? null : 'text-[#8A8A8A]',
                                      )}
                                      title={displayValue || rawValue}
                                    >
                                      {displayValue || '—'}
                                    </span>
                                  ) : isWorkflowNode && isMessageNameColumn(columnName) ? (
                                    // Message Name: secs-message / socket-message 목록 드롭다운
                                    <select
                                      value={rawValue}
                                      onChange={(event) =>
                                        onChangeDetailValue(row.id, columnIndex, event.target.value)
                                      }
                                      className="h-8 w-full min-w-0 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                                    >
                                      <option value="">—</option>
                                      {/* 현재 값이 목록에 없으면 fallback option으로 보존 */}
                                      {rawValue &&
                                        !allMessageOptions.some((option) => option.value === rawValue) && (
                                        <option value={rawValue}>{rawValue}</option>
                                      )}
                                      {allMessageOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : isWorkflowNode && isEventIdColumn(columnName) ? (
                                    // EventId: eventides 목록 드롭다운 (SECS 모델 전용)
                                    <select
                                      value={rawValue}
                                      onChange={(event) =>
                                        onChangeDetailValue(row.id, columnIndex, event.target.value)
                                      }
                                      className="h-8 w-full min-w-0 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                                    >
                                      <option value="">—</option>
                                      {/* 현재 값이 목록에 없으면 fallback option으로 보존 */}
                                      {rawValue && !workflowEventIdOptions.includes(rawValue) && (
                                        <option value={rawValue}>{rawValue}</option>
                                      )}
                                      {workflowEventIdOptions.map((id) => (
                                        <option key={id} value={id}>
                                          {id}
                                        </option>
                                      ))}
                                    </select>
                                  ) : isDcopItemsNode && isDcopWorkflowNameColumn(columnName) ? (
                                    // dcop-itemes Workflow Name: workflow 목록 드롭다운
                                    <select
                                      value={rawValue}
                                      onChange={(event) =>
                                        onChangeDetailValue(row.id, columnIndex, event.target.value)
                                      }
                                      className="h-8 w-full min-w-0 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                                    >
                                      <option value="">—</option>
                                      {/* 현재 값이 목록에 없으면 fallback option으로 보존 */}
                                      {rawValue && !dcopWorkflowNameOptions.includes(rawValue) && (
                                        <option value={rawValue}>{rawValue}</option>
                                      )}
                                      {dcopWorkflowNameOptions.map((name) => (
                                        <option key={name} value={name}>
                                          {name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : isDcopItemsNode && isEventIdColumn(columnName) ? (
                                    // dcop-itemes EventId: eventides 목록 드롭다운 (SECS 모델 전용)
                                    <select
                                      value={rawValue}
                                      onChange={(event) =>
                                        onChangeDetailValue(row.id, columnIndex, event.target.value)
                                      }
                                      className="h-8 w-full min-w-0 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                                    >
                                      <option value="">—</option>
                                      {/* 현재 값이 목록에 없으면 fallback option으로 보존 */}
                                      {rawValue && !workflowEventIdOptions.includes(rawValue) && (
                                        <option value={rawValue}>{rawValue}</option>
                                      )}
                                      {workflowEventIdOptions.map((id) => (
                                        <option key={id} value={id}>
                                          {id}
                                        </option>
                                      ))}
                                    </select>
                                  ) : isDcopItemsNode && isDcopCollectionRuleColumn(columnName) ? (
                                    // dcop-itemes Collection Rule: LAST / FIRST / AVERAGE / MIN / MAX 선택
                                    // 값이 없으면 기본값 LAST로 표시 (신규 행 추가 시 handleAddDetailRow에서도 LAST 주입)
                                    <select
                                      value={rawValue || 'LAST'}
                                      onChange={(event) =>
                                        onChangeDetailValue(row.id, columnIndex, event.target.value)
                                      }
                                      className="h-8 w-full min-w-0 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                                    >
                                      {DCOP_COLLECTION_RULE_OPTIONS.map((rule) => (
                                        <option key={rule} value={rule}>
                                          {rule}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    // 일반 Input (Workflow Name은 중복 시 에러 표시)
                                    <Input
                                      value={rawValue}
                                      onChange={(event) =>
                                        onChangeDetailValue(row.id, columnIndex, event.target.value)
                                      }
                                      className={cn(
                                        'h-8 w-full min-w-0',
                                        isDuplicate
                                          ? 'border-[#C5534B] focus-visible:ring-[#C5534B]/30'
                                          : null,
                                      )}
                                      title={
                                        isDuplicate
                                          ? '다른 행에 동일한 Workflow Name이 있습니다.'
                                          : undefined
                                      }
                                    />
                                  )}
                                </TableCell>
                              )
                            })}

                            {canEditTableRows ? (
                              <TableCell className="whitespace-nowrap">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-8 rounded-lg text-[#6A7971] hover:bg-[#F3F7F5] hover:text-[#C5534B]"
                                  onClick={() => onDeleteDetailRow(row.id)}
                                  aria-label={`${row.values[0] || '새 row'} 삭제`}
                                >
                                  <Trash2 className="size-4" aria-hidden="true" />
                                </Button>
                              </TableCell>
                            ) : null}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <Dialog
        open={isWorkflowEditorOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseWorkflowTextEditor()
          }
        }}
      >
        <DialogContent
          className="!left-4 !right-4 !top-4 !bottom-4 !w-auto !max-w-none !translate-x-0 !translate-y-0 overflow-hidden p-0 md:!left-6 md:!right-6 md:!top-6 md:!bottom-6"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="shrink-0 border-b border-[#EEF3F0] px-6 py-5">
            <DialogTitle>{workflowEditorTitle || 'Workflow 편집'}</DialogTitle>
            <DialogDescription>
              {isFilterColumn(workflowTextEditor?.columnName)
                ? 'workflow_filter를 canonical group/condition 구조로 편집합니다.'
                : 'action_data_index를 mdfTemplateName과 field 매핑 기준으로 편집합니다.'}
            </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
              <div className="flex h-full min-h-0 flex-col gap-3">
            {workflowEditorErrorMessage ? (
              <p className="rounded-xl border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-sm text-[#B4483F]">
                {workflowEditorErrorMessage}
              </p>
            ) : null}

            {isFilterColumn(workflowTextEditor?.columnName) ? (
              workflowFilterDraft.mode === 'raw' ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <p className="text-sm text-[#C5534B]">
                    현재 값은 structured editor가 안전하게 해석할 수 없어 raw 모드로 유지합니다.
                  </p>
                  <textarea
                    value={workflowFilterDraft.rawValue}
                    onChange={(event) =>
                      setWorkflowFilterDraft((previousDraft) => ({
                        ...previousDraft,
                        rawValue: event.target.value,
                      }))
                    }
                    className="min-h-0 w-full flex-1 resize-none overflow-auto rounded-xl border border-[#DCE5E0] bg-[#FAFCFB] p-3 font-mono text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                    readOnly={isReadOnly}
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
                    <WorkflowNodeEditor
                      node={workflowFilterDraft.rootGroup}
                      depth={0}
                      readOnly={isReadOnly}
                      onUpdateNode={handleUpdateWorkflowNode}
                      onAddCondition={handleAddWorkflowCondition}
                      onAddGroup={handleAddWorkflowGroup}
                      onRemoveNode={handleRemoveWorkflowNode}
                    />
                  </div>
                </div>
              )
            ) : actionDataIndexDraft.mode === 'raw' ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <p className="text-sm text-[#C5534B]">
                  현재 값은 structured editor가 안전하게 해석할 수 없어 raw 모드로 유지합니다.
                </p>
                <textarea
                  value={actionDataIndexDraft.rawValue}
                  onChange={(event) =>
                    setActionDataIndexDraft((previousDraft) => ({
                      ...previousDraft,
                      rawValue: event.target.value,
                    }))
                  }
                  className="min-h-0 w-full flex-1 resize-none overflow-auto rounded-xl border border-[#DCE5E0] bg-[#FAFCFB] p-3 font-mono text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                  readOnly={isReadOnly}
                />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="grid gap-4 rounded-2xl border border-[#E4EAE6] bg-[#FAFCFB] px-4 py-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
                  <div className="space-y-2.5">
                    <label className="text-xs font-semibold text-[#1E3D33]">MDF Message</label>
                    <Select
                      value={actionDataIndexDraft.mdfTemplateName || EMPTY_MDF_TEMPLATE_VALUE}
                      disabled={isReadOnly}
                      onValueChange={(nextValue) =>
                        setActionDataIndexDraft((previousDraft) => ({
                          ...previousDraft,
                          mdfTemplateName:
                            nextValue === EMPTY_MDF_TEMPLATE_VALUE
                              ? ''
                              : nextValue,
                        }))
                      }
                    >
                      <SelectTrigger disabled={isReadOnly}>
                        <SelectValue placeholder="MDF message를 선택해 주세요." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_MDF_TEMPLATE_VALUE}>선택 안 함</SelectItem>
                        {workflowMdfMessageOptions.map((messageOption) => (
                          <SelectItem
                            key={`${messageOption.sourceName}-${messageOption.messageName}`}
                            value={messageOption.messageName}
                          >
                            {messageOption.messageName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-[#738078]">
                      현재 model의 MDF XML 내부 메시지 이름을 선택하면 `mdfTemplateName`으로 저장됩니다.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-semibold text-[#1E3D33]">선택된 XML Preview</label>
                    <div className="min-h-[124px] max-h-[180px] overflow-auto rounded-xl border border-[#DCE5E0] bg-white px-3 py-2.5">
                      {selectedWorkflowMdfMessage?.xmlSnippet ? (
                        <pre className="whitespace-pre-wrap break-all font-mono text-xs text-[#22322B]">
                          {selectedWorkflowMdfMessage.xmlSnippet}
                        </pre>
                      ) : actionDataIndexDraft.mdfTemplateName.trim() ? (
                        <p className="text-sm text-[#65726B]">
                          현재 `mdfTemplateName`과 일치하는 MDF 메시지를 찾지 못했습니다.
                        </p>
                      ) : (
                        <p className="text-sm text-[#65726B]">
                          MDF 메시지를 선택하면 전체 XML 조각을 여기에서 바로 확인할 수 있습니다.
                        </p>
                      )}
                    </div>
                    <p className="text-[11px] text-[#738078]">
                      {selectedWorkflowMdfMessage?.sourceName
                        ? `Source MDF: ${selectedWorkflowMdfMessage.sourceName}`
                        : '업로드된 MDF XML에 정의된 메시지 본문을 그대로 보여 줍니다.'}
                    </p>
                  </div>

                </div>

                {/* Fields 테이블 레이블 및 '+field 추가' 버튼 영역 */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-[#1E3D33]">Fields</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-lg px-2 text-xs"
                    onClick={() =>
                      setActionDataIndexDraft((previousDraft) => ({
                        ...previousDraft,
                        fields: [...previousDraft.fields, createEmptyActionDataIndexField()],
                      }))
                    }
                    disabled={isReadOnly}
                  >
                    <Plus className="size-3" aria-hidden="true" />
                    field 추가
                  </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#E4EAE6]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-[#F6F9F7]">
                      <TableRow className="bg-[#F6F9F7]">
                        <TableHead className="w-[112px]">순서</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>from</TableHead>
                        <TableHead>path</TableHead>
                        <TableHead>transforms</TableHead>
                        <TableHead className="w-[72px]">작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {actionDataIndexDraft.fields.map((field, fieldIndex) => (
                        <TableRow
                          key={field.id}
                          className={cn(
                            'align-top',
                            draggingActionDataIndexFieldId === field.id && 'bg-[#EEF7F1] opacity-70',
                          )}
                          onDragOver={(event) => handleActionDataIndexFieldDragOver(event, field.id)}
                          onDrop={(event) => handleActionDataIndexFieldDrop(event, field.id)}
                        >
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8 cursor-grab rounded-lg text-[#6A7971] hover:bg-[#F3F7F5] active:cursor-grabbing"
                                draggable={!isReadOnly}
                                onDragStart={(event) => handleActionDataIndexFieldDragStart(event, field.id)}
                                onDragEnd={handleActionDataIndexFieldDragEnd}
                                disabled={isReadOnly}
                                aria-label={`${field.fieldName || 'field'} 순서 드래그`}
                                title="드래그해서 순서 변경"
                              >
                                <GripVertical className="size-4" aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8 rounded-lg text-[#6A7971] hover:bg-[#F3F7F5]"
                                onClick={() => handleMoveActionDataIndexField(field.id, fieldIndex - 1)}
                                disabled={isReadOnly || fieldIndex === 0}
                                aria-label={`${field.fieldName || 'field'} 위로 이동`}
                                title="위로 이동"
                              >
                                <ArrowUp className="size-4" aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8 rounded-lg text-[#6A7971] hover:bg-[#F3F7F5]"
                                onClick={() => handleMoveActionDataIndexField(field.id, fieldIndex + 1)}
                                disabled={isReadOnly || fieldIndex === actionDataIndexDraft.fields.length - 1}
                                aria-label={`${field.fieldName || 'field'} 아래로 이동`}
                                title="아래로 이동"
                              >
                                <ArrowDown className="size-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={field.fieldName}
                              onChange={(event) =>
                                setActionDataIndexDraft((previousDraft) => ({
                                  ...previousDraft,
                                  fields: updateActionDataIndexDraftRow(
                                    previousDraft.fields,
                                    field.id,
                                    {
                                      fieldName: event.target.value,
                                    },
                                  ),
                                }))
                              }
                              placeholder="EQPID"
                              readOnly={isReadOnly}
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              value={field.from}
                              onChange={(event) =>
                                setActionDataIndexDraft((previousDraft) => ({
                                  ...previousDraft,
                                  fields: updateActionDataIndexDraftRow(
                                    previousDraft.fields,
                                    field.id,
                                    {
                                      from: event.target.value as WorkflowLookupSource,
                                    },
                                  ),
                                }))
                              }
                              className="h-9 w-full rounded-md border border-[#DCE5E0] bg-white px-2 text-sm text-[#22322B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30"
                              disabled={isReadOnly}
                            >
                              {LOOKUP_SOURCE_OPTIONS.map((source) => (
                                <option key={source} value={source}>
                                  {source}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={field.path}
                              onChange={(event) =>
                                setActionDataIndexDraft((previousDraft) => ({
                                  ...previousDraft,
                                  fields: updateActionDataIndexDraftRow(
                                    previousDraft.fields,
                                    field.id,
                                    {
                                      path: event.target.value,
                                    },
                                  ),
                                }))
                              }
                              placeholder="eqpId"
                              readOnly={isReadOnly}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              {field.transforms.length === 0 ? (
                                <p className="text-[11px] text-[#97A39C]">transform 없음</p>
                              ) : (
                                field.transforms.map((transform) => (
                                  <div key={transform.id} className="flex items-center gap-2">
                                    <Input
                                      value={transform.value}
                                      onChange={(event) =>
                                        setActionDataIndexDraft((previousDraft) => ({
                                          ...previousDraft,
                                          fields: updateActionDataIndexDraftRow(
                                            previousDraft.fields,
                                            field.id,
                                            {
                                              transforms: updateTransforms(
                                                field.transforms,
                                                transform.id,
                                                { value: event.target.value },
                                              ),
                                            },
                                          ),
                                        }))
                                      }
                                      placeholder="trim"
                                      readOnly={isReadOnly}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="size-8 rounded-lg text-[#6A7971] hover:bg-[#F3F7F5] hover:text-[#C5534B]"
                                      onClick={() =>
                                        setActionDataIndexDraft((previousDraft) => ({
                                          ...previousDraft,
                                          fields: updateActionDataIndexDraftRow(
                                            previousDraft.fields,
                                            field.id,
                                            {
                                              transforms: field.transforms.filter(
                                                (item) => item.id !== transform.id,
                                              ),
                                            },
                                          ),
                                        }))
                                      }
                                      disabled={isReadOnly}
                                      aria-label="transform 삭제"
                                    >
                                      <Trash2 className="size-4" aria-hidden="true" />
                                    </Button>
                                  </div>
                                ))
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setActionDataIndexDraft((previousDraft) => ({
                                    ...previousDraft,
                                    fields: updateActionDataIndexDraftRow(
                                      previousDraft.fields,
                                      field.id,
                                      {
                                        transforms: [...field.transforms, createTransformDraft()],
                                      },
                                    ),
                                  }))
                                }
                                disabled={isReadOnly}
                              >
                                <Plus className="size-3.5" aria-hidden="true" />
                                transform 추가
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-8 rounded-lg text-[#6A7971] hover:bg-[#F3F7F5] hover:text-[#C5534B]"
                              onClick={() =>
                                setActionDataIndexDraft((previousDraft) => ({
                                  ...previousDraft,
                                  fields:
                                    previousDraft.fields.length > 1
                                      ? previousDraft.fields.filter((item) => item.id !== field.id)
                                      : [createEmptyActionDataIndexField()],
                                }))
                              }
                              disabled={isReadOnly}
                              aria-label="field 삭제"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t border-[#EEF3F0] px-6 py-4">
            <Button variant="outline" onClick={handleCloseWorkflowTextEditor}>
              취소
            </Button>
            {!isReadOnly ? <Button onClick={handleSaveWorkflowTextEditor}>적용</Button> : null}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
})
