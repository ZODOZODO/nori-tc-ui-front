import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useModelNodeDetail } from '../hooks/useModelNodeDetail'
import { useModelFlowList } from '../hooks/useModelFlowList'
import { useModelFlowDetail } from '../hooks/useModelFlowDetail'
import { useModelFlowMutations } from '../hooks/useModelFlowMutations'
import {
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  summarizeActionDataIndexValue,
  summarizeWorkflowFilterValue,
} from '../lib/model-detail-editor'
import {
  MODEL_DETAIL_NODE_LABELS,
  SECS_DETAIL_NODES,
  SOCKET_DETAIL_NODES,
  type ModelDcopItem,
  type ModelDetailNode,
  type ModelDetailRow,
  type ModelFlowSummary,
  type ModelFlowUpdateRequest,
  type ModelMdfContent,
  type ModelInfo,
  type ModelOpenedTab,
} from '../types/model.types'
import { WorkflowFilterEditorModal } from './WorkflowFilterEditorModal'
import { ActionDataIndexEditorModal } from './ActionDataIndexEditorModal'
import { ModelFlowSidebar } from './ModelFlowSidebar'
import { FlowCard } from './FlowCard'

const WORKFLOW_MODAL_EDITABLE_COLUMNS = new Set(['filter', 'data index'])

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
  // 모달이 편집 중인 raw JSON string (filter 또는 action_data_index).
  // 추출된 모달은 자기 자신의 draft state 를 보유하므로 ModelDetailPanel 은 row.values 의
  // raw string 만 전달하면 됩니다.
  const [workflowEditorValue, setWorkflowEditorValue] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // F4: Message Flows 사이드바 — selectedFlowId 는 ModelDetailPanel 로컬 state.
  // F5 에서 model-ui.store 로 이관 예정.
  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null)
  const activeModelVersionKey = activeModel?.modelVersionKey ?? null
  const modelFlowListQuery = useModelFlowList(activeModelVersionKey)
  const modelFlowDetailQuery = useModelFlowDetail(activeModelVersionKey, selectedFlowId)
  const { updateFlowMutation } = useModelFlowMutations(activeModelVersionKey)

  // activeTab 이 바뀌면 Flow 선택 초기화 — 다른 모델로 전환 시 stale flowId 회피.
  useEffect(() => {
    setSelectedFlowId(null)
  }, [activeTab])

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
  const isFilterEditorOpen =
    isWorkflowEditorOpen && isFilterColumn(workflowTextEditor?.columnName)
  const isActionDataIndexEditorOpen =
    isWorkflowEditorOpen && isDataIndexColumn(workflowTextEditor?.columnName)
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

  const handleOpenWorkflowTextEditor = (
    row: ModelDetailRow,
    rowIndex: number,
    columnIndex: number,
  ) => {
    const columnName = normalizedDetailColumns[columnIndex]
    if (!isWorkflowModalEditableColumn(normalizedDetailNode, columnName)) {
      return
    }

    setWorkflowTextEditor({
      rowId: row.id,
      rowLabel: row.values[0] ?? '',
      rowIndex,
      columnIndex,
      columnName,
    })
    setWorkflowEditorValue(row.values[columnIndex] ?? '')
  }

  const handleCloseWorkflowTextEditor = () => {
    setWorkflowTextEditor(null)
    setWorkflowEditorValue('')
  }

  const handleSaveWorkflowTextEditor = (nextValue: string) => {
    if (!workflowTextEditor || isReadOnly) {
      return
    }
    onChangeDetailValue(workflowTextEditor.rowId, workflowTextEditor.columnIndex, nextValue)
    handleCloseWorkflowTextEditor()
  }

  // Message Flows 사이드바용 — modelFlowListQuery + Unassigned DCOPs.
  const messageFlowSummaries = useMemo<readonly ModelFlowSummary[]>(
    () => modelFlowListQuery.data?.items ?? [],
    [modelFlowListQuery.data?.items],
  )
  // Unassigned DCOPs 는 dcop-itemes 노드의 워크플로우=null 행 — Reference 영역에서 별도 group.
  // ModelDcopItem 형태 (workflowName 등) 가 detailRows 와 다르므로 modelFlowDetailQuery 에 없음.
  // 1차 릴리즈에서는 dcop-itemes 노드를 직접 띄우지 않은 상태에서는 빈 배열을 전달
  // — Unassigned 표시는 ModelFlowSidebar 내부 helper 가 빈 입력을 처리.
  const referenceUnassignedDcopItems = useMemo<readonly ModelDcopItem[]>(() => [], [])

  const handleSelectFlow = (flowId: number) => {
    // Flow 선택은 Reference 노드 선택과 상호 배타 — 선택 즉시 detail fetch.
    setSelectedFlowId(flowId)
  }

  const handleAddFlow = () => {
    // F5 (draft + store) 도입 전까지는 placeholder. 사용자가 [+ Add Flow] 클릭 시
    // 빈 Flow 추가가 아직 미구현임을 알리는 콘솔 로그만 남김 (Plan F5 단계 작업).
    console.warn('[ModelDetailPanel] handleAddFlow: F5 단계에서 draft + POST 구현 예정')
  }

  // FlowCard 의 [편집...] 버튼은 F4 단계에서 모달로 wiring 하지 않음 — 기존 dcop-itemes
  // 평면 UI 와의 통합 처리는 F5 단계에서 store + 모달 상태 일원화와 함께 진행 (Plan F5).
  const handleFlowEditWorkflowFilter = () => {
    console.warn('[ModelDetailPanel] FlowCard onEditWorkflowFilter: F5 단계 wiring 예정')
  }
  const handleFlowEditActionDataIndex = () => {
    console.warn('[ModelDetailPanel] FlowCard onEditActionDataIndex: F5 단계 wiring 예정')
  }
  const handleFlowAddDcopItem = () => {
    console.warn('[ModelDetailPanel] FlowCard onAddDcopItem: F5 단계 wiring 예정')
  }

  const flowDetail = modelFlowDetailQuery.data ?? null
  const flowProtocol: 'SECS' | 'SOCKET' = isSocketModel ? 'SOCKET' : 'SECS'
  const flowSaveStatus: 'idle' | 'saving' | 'error' = updateFlowMutation.isPending
    ? 'saving'
    : updateFlowMutation.isError
      ? 'error'
      : 'idle'
  const flowSaveErrorMessage =
    updateFlowMutation.isError && updateFlowMutation.error instanceof Error
      ? updateFlowMutation.error.message
      : null

  const handleSaveFlow = (payload: ModelFlowUpdateRequest) => {
    if (selectedFlowId === null) {
      return
    }
    updateFlowMutation.mutate({ flowId: selectedFlowId, request: payload })
  }

  // dcop-itemes 노드에서 Workflow Name 컬럼 인덱스 찾기 — Unassigned client-side group 용.
  // deps 는 raw props (detailColumns) — normalizedDetailColumns 는 매 render 마다 새 ref 가능.
  const dcopWorkflowNameColumnIndex = useMemo(() => {
    if (!isDcopItemsNode) {
      return -1
    }
    return detailColumns.findIndex((columnName) => isDcopWorkflowNameColumn(columnName))
  }, [isDcopItemsNode, detailColumns])

  // dcop-itemes 일 때 rows 를 Assigned / Unassigned 로 분리. 다른 노드는 split 없음.
  const dcopGroupedRows = useMemo(() => {
    if (!isDcopItemsNode || dcopWorkflowNameColumnIndex < 0) {
      return null
    }
    const assigned: ModelDetailRow[] = []
    const unassigned: ModelDetailRow[] = []
    for (const row of detailRows) {
      const workflowName = (row.values[dcopWorkflowNameColumnIndex] ?? '').trim()
      if (workflowName === '') {
        unassigned.push(row)
      } else {
        assigned.push(row)
      }
    }
    return { assigned, unassigned }
  }, [detailRows, isDcopItemsNode, dcopWorkflowNameColumnIndex])

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
          <aside className="flex w-[260px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[#E4EAE6] bg-[#FAFCFB] p-2">
            <ModelFlowSidebar
              summaries={messageFlowSummaries}
              unassignedDcopItems={referenceUnassignedDcopItems}
              selectedFlowId={selectedFlowId}
              onSelectFlow={handleSelectFlow}
              onAddFlow={handleAddFlow}
            />

            <section className="rounded-lg border border-[#DDE8E1] bg-white p-2">
              <p className="px-1 pb-2 text-xs font-semibold text-[#243129]">Reference</p>
              <div className="flex flex-col gap-0.5">
                {detailNodes.map((node) => (
                  <button
                    key={node}
                    type="button"
                    onClick={() => {
                      // Reference 노드 선택은 Flow selection 과 상호 배타.
                      setSelectedFlowId(null)
                      onSelectDetailNode(node)
                    }}
                    className={cn(
                      'rounded-md px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30',
                      selectedFlowId === null && normalizedDetailNode === node
                        ? 'bg-[#EAF5EE] font-semibold text-[#1F2D26]'
                        : 'text-[#51605A] hover:bg-[#F1F6F3]',
                    )}
                  >
                    {MODEL_DETAIL_NODE_LABELS[node]}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3">
            {selectedFlowId !== null ? (
              modelFlowDetailQuery.isLoading ? (
                <p className="text-sm text-[#647169]">Flow 데이터를 불러오는 중입니다.</p>
              ) : modelFlowDetailQuery.isError ? (
                <p className="text-sm text-[#C5534B]">Flow 데이터를 불러오지 못했습니다.</p>
              ) : flowDetail ? (
                <FlowCard
                  key={flowDetail.flowId}
                  flow={flowDetail}
                  protocol={flowProtocol}
                  messageOptions={[]}
                  eventOptions={[]}
                  mdfTemplateOptions={[]}
                  onSave={handleSaveFlow}
                  saveStatus={flowSaveStatus}
                  errorMessage={flowSaveErrorMessage}
                  onEditWorkflowFilter={handleFlowEditWorkflowFilter}
                  onEditActionDataIndex={handleFlowEditActionDataIndex}
                  onAddDcopItem={handleFlowAddDcopItem}
                />
              ) : (
                <p className="text-sm text-[#647169]">선택된 Flow 가 없습니다.</p>
              )
            ) : isMdfNode ? (
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
                        (dcopGroupedRows
                          ? [...dcopGroupedRows.assigned, ...dcopGroupedRows.unassigned]
                          : detailRows
                        ).map((row, rowIndex, displayedRows) => {
                          // dcop-itemes Unassigned group divider — 첫 unassigned row 전에 표시.
                          const assignedCount = dcopGroupedRows?.assigned.length ?? -1
                          const showUnassignedHeader =
                            dcopGroupedRows !== null && rowIndex === assignedCount && assignedCount < displayedRows.length
                          return (
                          <>
                          {showUnassignedHeader ? (
                            <TableRow key={`unassigned-divider-${row.id}`} className="bg-[#F1F5F2]">
                              <TableCell
                                colSpan={normalizedDetailColumns.length + (canEditTableRows ? 1 : 0)}
                                className="py-1.5 text-xs font-semibold text-[#6A7971]"
                              >
                                ── Unassigned ──
                              </TableCell>
                            </TableRow>
                          ) : null}
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
                          </>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <WorkflowFilterEditorModal
        open={isFilterEditorOpen}
        value={workflowEditorValue}
        readOnly={isReadOnly}
        titleLabel={workflowEditorTitle}
        errorMessage={workflowEditorErrorMessage}
        onClose={handleCloseWorkflowTextEditor}
        onSave={handleSaveWorkflowTextEditor}
      />

      <ActionDataIndexEditorModal
        open={isActionDataIndexEditorOpen}
        value={workflowEditorValue}
        readOnly={isReadOnly}
        titleLabel={workflowEditorTitle}
        errorMessage={workflowEditorErrorMessage}
        workflowMdfContents={workflowMdfContents}
        onClose={handleCloseWorkflowTextEditor}
        onSave={handleSaveWorkflowTextEditor}
      />
    </>
  )
})
