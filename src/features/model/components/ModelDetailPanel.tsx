import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useModelNodeDetail } from '../hooks/useModelNodeDetail'
import { useModelFlowList } from '../hooks/useModelFlowList'
import { useModelFlowDetail } from '../hooks/useModelFlowDetail'
import { useModelFlowMutations } from '../hooks/useModelFlowMutations'
import {
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import {
  summarizeActionDataIndexValue,
  summarizeFlowFilterValue,
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
import { FlowFilterEditorModal } from './FlowFilterEditorModal'
import { ActionDataIndexEditorModal } from './ActionDataIndexEditorModal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ModelFlowSidebar } from './ModelFlowSidebar'
import { FlowCard, type FlowCardHandle } from './FlowCard'
import { DcopItemPickerModal } from './DcopItemPickerModal'
import {
  SelectableTable,
  type ColumnDef,
  type SelectableTableActionColumn,
} from '@/shared/components/SelectableTable'
import {
  createDcopItemsColumns,
  createGenericInputColumns,
  createModelParameterColumns,
  createWorkflowColumns,
} from './modelDetailColumnDefs'
import { useModelUiStore } from '../stores/model-ui.store'
import { draftToFlow } from '../lib/model-flow-editor'

const FLOW_MODAL_EDITABLE_COLUMNS = new Set(['filter', 'data index'])

const MODEL_DETAIL_TEXT_FIELD_MIN_WIDTH_CH = 26
const MODEL_DETAIL_TEXT_FIELD_PADDING_CH = 14
const MODEL_DETAIL_MODAL_PREVIEW_WIDTH = '180px'

interface FlowTextEditorState {
  rowId: string
  rowLabel: string
  rowIndex: number
  columnIndex: number
  columnName: string
}

interface FlowMessageOption {
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
  flowMdfContents: ModelMdfContent[]
  isDetailLoading: boolean
  detailErrorMessage: string | null
  isEditMode: boolean
  isLockedByOtherUser: boolean
  lockOwner: string | null
  isCheckoutPending: boolean
  isCheckinPending: boolean
  isUndoPending: boolean
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
const isFlowModalEditableColumn = (
  detailNode: ModelDetailNode | null,
  columnName: string | undefined,
): boolean => {
  if (detailNode !== 'workflow' || !columnName) {
    return false
  }

  return FLOW_MODAL_EDITABLE_COLUMNS.has(columnName.trim().toLowerCase())
}

const isFilterColumn = (columnName: string | undefined): boolean =>
  (columnName ?? '').trim().toLowerCase() === 'filter'

const isDataIndexColumn = (columnName: string | undefined): boolean =>
  (columnName ?? '').trim().toLowerCase() === 'data index'

const isMessageNameColumn = (columnName: string | undefined): boolean =>
  (columnName ?? '').trim().toLowerCase() === 'message name'

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
  flowMdfContents,
  isDetailLoading,
  detailErrorMessage,
  isEditMode,
  isLockedByOtherUser,
  lockOwner,
  isCheckoutPending,
  isCheckinPending,
  isUndoPending,
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
  const [flowTextEditor, setFlowTextEditor] = useState<FlowTextEditorState | null>(null)
  // 모달이 편집 중인 raw JSON string (filter 또는 action_data_index).
  // 추출된 모달은 자기 자신의 draft state 를 보유하므로 ModelDetailPanel 은 row.values 의
  // raw string 만 전달하면 됩니다.
  const [flowEditorValue, setFlowEditorValue] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // 우상단 통합 Save 버튼이 FlowCard 의 imperative save() 를 트리거하기 위한 ref.
  // FlowCard 내부 draft state 는 closure 안에 있어 외부에서 접근 불가하므로
  // forwardRef + useImperativeHandle 패턴으로 진입점을 노출합니다.
  const flowCardRef = useRef<FlowCardHandle | null>(null)

  // F5: Message Flows 사이드바 — selectedFlowId / draftFlow 는 model-ui store 로 이관.
  const selectedFlowId = useModelUiStore((state) => state.selectedFlowId)
  const draftFlow = useModelUiStore((state) => state.draftFlow)
  const setSelectedFlowId = useModelUiStore((state) => state.setSelectedFlowId)
  const startDraftFlow = useModelUiStore((state) => state.startDraftFlow)
  const clearDraftFlow = useModelUiStore((state) => state.clearDraftFlow)
  const activeModelVersionKey = activeModel?.modelVersionKey ?? null
  const modelFlowListQuery = useModelFlowList(activeModelVersionKey)
  const modelFlowDetailQuery = useModelFlowDetail(activeModelVersionKey, selectedFlowId)
  const { createFlowMutation, updateFlowMutation, deleteFlowMutation } =
    useModelFlowMutations(activeModelVersionKey)
  const [flowIdToDelete, setFlowIdToDelete] = useState<number | null>(null)

  // activeTab 이 바뀌면 Flow 선택 / draft 초기화 — 다른 모델로 전환 시 stale 회피.
  useEffect(() => {
    setSelectedFlowId(null)
  }, [activeTab, setSelectedFlowId])

  const detailNodes = resolveDetailNodes(activeModel)
  const normalizedDetailNode = detailNode ?? detailNodes[0] ?? null
  const normalizedDetailColumns = detailColumns.length > 0 ? detailColumns : ['Value']
  const isMdfNode = normalizedDetailNode === 'mdf'
  const isFlowNode = normalizedDetailNode === 'workflow'
  const isDcopItemsNode = normalizedDetailNode === 'dcop-itemes'
  const isBranchModel = Boolean(activeModel?.parentModel?.trim())
  const isDeprecatedBranch =
    isBranchModel && activeModel?.status.trim().toUpperCase() === 'DEPRECATED'
  const isReadOnly = !isEditMode || isLockedByOtherUser
  const isFlowEditorOpen = flowTextEditor !== null && normalizedDetailNode === 'workflow'
  const isFilterEditorOpen =
    isFlowEditorOpen && isFilterColumn(flowTextEditor?.columnName)
  const isActionDataIndexEditorOpen =
    isFlowEditorOpen && isDataIndexColumn(flowTextEditor?.columnName)
  const canEditTableRows = !isReadOnly && !isMdfNode

  // SOCKET 모델 여부 판단
  const isSocketModel = activeModel?.commInterface?.toUpperCase() === 'SOCKET'

  // FlowCard 의 Identity Message dropdown 도 같은 메시지 목록을 사용합니다 —
  // Flow 선택 (selectedFlowId !== null) 또는 draft Flow 입력 모드일 때도 활성화.
  // SPEC line 115-116: Flow Message dropdown 은 protocol 별 (SECS+MES) / (Socket+MES) 통합.
  const isFlowCardVisible = selectedFlowId !== null || draftFlow !== null
  // workflow 편집 시 Message Name 정합성을 위해 secs-message / socket-message 데이터를 조회합니다.
  // (workflow / Flow 어느 쪽도 보이지 않으면 fetch 생략 — 읽기 전용 reference 노드 진입 시 무용 query 방지)
  const flowMessageDetailNode = isSocketModel ? 'socket-message' : 'secs-message'
  const messagesQueryEnabled =
    (isFlowNode && !isReadOnly) || isFlowCardVisible
  const flowMessageQuery = useModelNodeDetail(
    messagesQueryEnabled ? (activeModel?.modelVersionKey ?? null) : null,
    flowMessageDetailNode,
  )
  // message 이름 컬럼은 첫 번째 컬럼 ('SECS Message Name' 또는 'Socket Message Name')
  const flowMessageOptions = useMemo(
    () => flowMessageQuery.data?.rows.map((row) => row.values[0] ?? '').filter(Boolean) ?? [],
    [flowMessageQuery.data?.rows],
  )

  // workflow 편집 시 MES Message Name도 포함합니다. (SECS/Socket 모델 공통 적용)
  const mesMessageQuery = useModelNodeDetail(
    messagesQueryEnabled ? (activeModel?.modelVersionKey ?? null) : null,
    'mes-message',
  )
  const mesMessageOptions = useMemo(
    () => mesMessageQuery.data?.rows.map((row) => row.values[0] ?? '').filter(Boolean) ?? [],
    [mesMessageQuery.data?.rows],
  )
  // 동일 message 이름이 여러 출처에 있으면 저장값은 그대로 두고 라벨만 병합해 보여 줍니다.
  const allMessageOptions = useMemo<FlowMessageOption[]>(() => {
    const sortedFlowMessageOptions = [...flowMessageOptions].sort((firstItem, secondItem) =>
      firstItem.localeCompare(secondItem),
    )
    const sortedMesMessageOptions = [...mesMessageOptions].sort((firstItem, secondItem) =>
      firstItem.localeCompare(secondItem),
    )
    const sourceSetByName = new Map<string, Set<string>>()

    sortedFlowMessageOptions.forEach((messageName) => {
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
  }, [isSocketModel, mesMessageOptions, flowMessageOptions])

  // SECS 모델 workflow / dcop-itemes 편집 시 EventId 정합성을 위해 eventides 데이터를 조회합니다.
  // (SOCKET 모델이거나 읽기 전용 상태에서는 조회하지 않음)
  const flowEventIdQuery = useModelNodeDetail(
    (isFlowNode || isDcopItemsNode) && !isReadOnly && !isSocketModel
      ? (activeModel?.modelVersionKey ?? null)
      : null,
    'eventides',
  )
  // EventId 컬럼은 eventides의 첫 번째 컬럼
  const flowEventIdOptions = useMemo(
    () => flowEventIdQuery.data?.rows.map((row) => row.values[0] ?? '').filter(Boolean) ?? [],
    [flowEventIdQuery.data?.rows],
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
  const detailColumnWidths = normalizedDetailColumns.map((columnName, columnIndex) => {
    if (isFlowModalEditableColumn(normalizedDetailNode, columnName)) {
      return MODEL_DETAIL_MODAL_PREVIEW_WIDTH
    }

    const maxValueLength = detailRows.reduce((maxLength, row) => {
      const rawValue = row.values[columnIndex] ?? ''
      const displayValue =
        isFlowNode && isMessageNameColumn(columnName)
          ? (allMessageOptions.find((option) => option.value === rawValue)?.label ?? rawValue)
          : rawValue

      return Math.max(maxLength, displayValue.length)
    }, columnName.length)

    return `${Math.max(
      maxValueLength + MODEL_DETAIL_TEXT_FIELD_PADDING_CH,
      MODEL_DETAIL_TEXT_FIELD_MIN_WIDTH_CH,
    )}ch`
  })

  // 모든 노드에서 columns 를 그대로 노출 — 컬럼 hide 로직은 v4 에서 폐기 (BE 응답이
  // 이미 컬럼 자체를 제거). (visibleIndex, rawIndex) 쌍 구조는 다른 분기 호환을 위해 유지.
  const visibleColumns = normalizedDetailColumns.map((columnName, columnIndex) => ({
    columnName,
    columnIndex,
  }))
  const visibleColumnCount = visibleColumns.length

  // FlowCard 가 우상단 Save 의 대상인지 — isFlowCardVisible 과 동일하지만
  // saveDisabled 흐름 안에서의 의미를 명시하기 위해 alias.
  // 이 경우 우상단 Save 는 PUT /details/{node} 가 아니라 FlowCard.save() 를 호출하며
  // 그 안에서 POST /flows 또는 PUT /flows/{id} 로 분기됩니다.
  const isFlowSaving = createFlowMutation.isPending || updateFlowMutation.isPending

  const saveDisabled =
    isDetailLoading ||
    (isFlowCardVisible ? isFlowSaving : isDetailSavePending) ||
    !isEditMode ||
    isLockedByOtherUser ||
    isMdfNode

  const flowEditorTitle = useMemo(() => {
    if (!flowTextEditor) {
      return ''
    }

    if (!flowTextEditor.rowLabel) {
      return flowTextEditor.columnName
    }

    return `${flowTextEditor.rowLabel} / ${flowTextEditor.columnName}`
  }, [flowTextEditor])

  const flowEditorErrorMessage = useMemo(() => {
    if (!flowTextEditor || !actionErrorMessage) {
      return null
    }

    const normalizedMessage = actionErrorMessage.trim()
    if (!normalizedMessage.startsWith('workflow ')) {
      return normalizedMessage
    }

    const rowPrefix = `workflow ${flowTextEditor.rowIndex + 1}행`
    return normalizedMessage.startsWith(rowPrefix) ? normalizedMessage : null
  }, [actionErrorMessage, flowTextEditor])

  const handleOpenFlowTextEditor = (
    row: ModelDetailRow,
    rowIndex: number,
    columnIndex: number,
  ) => {
    const columnName = normalizedDetailColumns[columnIndex]
    if (!isFlowModalEditableColumn(normalizedDetailNode, columnName)) {
      return
    }

    setFlowTextEditor({
      rowId: row.id,
      rowLabel: row.values[0] ?? '',
      rowIndex,
      columnIndex,
      columnName,
    })
    setFlowEditorValue(row.values[columnIndex] ?? '')
  }

  const handleCloseFlowTextEditor = () => {
    setFlowTextEditor(null)
    setFlowEditorValue('')
  }

  const handleSaveFlowTextEditor = (nextValue: string) => {
    if (!flowTextEditor || isReadOnly) {
      return
    }
    onChangeDetailValue(flowTextEditor.rowId, flowTextEditor.columnIndex, nextValue)
    handleCloseFlowTextEditor()
  }

  // Message Flows 사이드바용 — modelFlowListQuery 만 (Unassigned 영역은 v4 에서 폐기).
  const messageFlowSummaries = useMemo<readonly ModelFlowSummary[]>(
    () => modelFlowListQuery.data?.items ?? [],
    [modelFlowListQuery.data?.items],
  )
  // DcopItemPickerModal 의 좌측 Reference pool 공급용 — dcop-itemes 노드의 평면 응답을
  // 그대로 재사용해 별 endpoint 추가 없이 picker 가 모든 dcop_item 후보를 갖도록 한다.
  // 활성화 조건: activeModelVersionKey 가 있을 때 — 모델 진입 즉시 prefetch.
  const dcopItemesQuery = useModelNodeDetail(activeModelVersionKey, 'dcop-itemes')
  // dcop-itemes 응답 (columns/values 평면) 을 picker 가 다루는 ModelDcopItem 으로 변환.
  // v4 에서 응답의 workflowName 컬럼은 제거됐으므로 dcopItemName + row.id 의 PK 만 사용한다.
  const referenceDcopItems = useMemo<readonly ModelDcopItem[]>(() => {
    const data = dcopItemesQuery.data
    if (!data || activeModelVersionKey === null) {
      return []
    }
    const dcopItemNameIndex = data.columns.findIndex(
      (column) => column.trim() === 'Dcop Item Name',
    )
    if (dcopItemNameIndex < 0) {
      return []
    }
    const variableIdIndex = data.columns.findIndex(
      (column) => column.trim() === 'VariableId',
    )
    return data.rows.map((row) => {
      // row.id 는 `dcop:{key}` 형식 (ModelDetailResponseSupport.modelRowId). 키가 비어 있으면 null.
      const dcopKeyPart = row.id.startsWith('dcop:') ? row.id.slice('dcop:'.length) : ''
      const parsedKey = Number.parseInt(dcopKeyPart, 10)
      return {
        dcopItemKey: Number.isFinite(parsedKey) && parsedKey > 0 ? parsedKey : null,
        modelVersionKey: activeModelVersionKey,
        dcopItemName: row.values[dcopItemNameIndex] ?? '',
        eventId: null,
        variableId: variableIdIndex >= 0 ? (row.values[variableIdIndex] ?? '') : '',
        collectionRule: 'LAST',
        calculationRule: null,
        orderRule: null,
        updatedAt: '',
      }
    })
  }, [dcopItemesQuery.data, activeModelVersionKey])

  const handleSelectFlow = (flowId: number) => {
    // Flow 선택은 Reference 노드 선택 / draftFlow 와 상호 배타 (store action 이 처리).
    setSelectedFlowId(flowId)
  }

  const handleAddFlow = () => {
    // store action 이 selectedFlowId 도 함께 정리합니다 — 우측 패널이 draft 카드로 전환.
    startDraftFlow()
  }

  // FlowCard 의 [편집...] 클릭 시 raw JSON + onChange 콜백을 받습니다.
  // ModelDetailPanel 이 wirimg 보관 state (모달 open 여부 / 현재 value / save callback) 를 보유하고,
  // 추출된 모달의 open / value / onSave 만 채워 줍니다.
  const [flowEditor, setFlowEditor] = useState<{
    kind: 'workflow-filter' | 'action-data-index'
    value: string
    onChange: (nextRaw: string) => void
  } | null>(null)

  const handleEditFlowFilter = (currentRaw: string, onChange: (nextRaw: string) => void) => {
    setFlowEditor({ kind: 'workflow-filter', value: currentRaw, onChange })
  }
  const handleFlowEditActionDataIndex = (
    currentRaw: string,
    onChange: (nextRaw: string) => void,
  ) => {
    setFlowEditor({ kind: 'action-data-index', value: currentRaw, onChange })
  }
  const handleCloseFlowEditor = () => setFlowEditor(null)
  const handleSaveFlowEditor = (nextValue: string) => {
    if (flowEditor === null) {
      return
    }
    flowEditor.onChange(nextValue)
    setFlowEditor(null)
  }

  const flowDetail = modelFlowDetailQuery.data ?? null

  // Plan D4 (dcop-flow-binding v4): "+ DCOP 추가" 클릭 시 dcop-itemes 노드 라우팅 대신
  // DcopItemPickerModal 을 열어 N:M binding 을 직접 편집합니다. draft 카드 (unsaved Flow) 는
  // PUT 대상 flowId 가 없으므로 picker 진입 거부 — Identity 먼저 저장 후 picker 사용.
  const [dcopPickerFlowId, setDcopPickerFlowId] = useState<number | null>(null)

  const handleFlowAddDcopItem = () => {
    if (selectedFlowId === null) {
      return
    }
    setDcopPickerFlowId(selectedFlowId)
  }

  const handleCloseDcopPicker = () => {
    setDcopPickerFlowId(null)
  }

  const handleSaveDcopPicker = (nextDcopItemKeys: readonly number[]) => {
    if (dcopPickerFlowId === null) {
      return
    }
    // picker 의 "확인" 은 즉시 PUT 대신 FlowCard.draft.dcopItems 에 반영만 합니다 —
    // 사용자가 우상단 통합 Save 를 눌렀을 때 5 섹션 + Collect 가 한 번의 PUT 으로
    // DB 에 반영됩니다. 따라서 picker 가 보낸 key 배열을 referenceDcopItems 풀에서
    // ModelDcopItem 본체로 매핑해 카드에 전달.
    const nextItems: ModelDcopItem[] = nextDcopItemKeys
      .map((key) => referenceDcopItems.find((item) => item.dcopItemKey === key) ?? null)
      .filter((item): item is ModelDcopItem => item !== null)
    flowCardRef.current?.setDcopItems(nextItems)
    setDcopPickerFlowId(null)
  }
  const flowProtocol: 'SECS' | 'SOCKET' = isSocketModel ? 'SOCKET' : 'SECS'
  const isDraftMode = draftFlow !== null

  // FlowCard Identity Message dropdown 옵션 — protocol 별 합쳐서 (SECS+MES) / (Socket+MES).
  // flowMessageOptions / mesMessageOptions 는 이미 위에서 같은 source 로 fetch 됨.
  // 중복 이름은 한 번만 노출 — workflow.message_name 컬럼은 단일 string 이므로 통합 namespace.
  const flowCardMessageOptions = useMemo<readonly { name: string }[]>(() => {
    const uniqueNames = new Set<string>()
    for (const name of flowMessageOptions) {
      uniqueNames.add(name)
    }
    for (const name of mesMessageOptions) {
      uniqueNames.add(name)
    }
    return [...uniqueNames].sort((a, b) => a.localeCompare(b)).map((name) => ({ name }))
  }, [flowMessageOptions, mesMessageOptions])

  // FlowCard Trigger Event Id dropdown 옵션 — eventides 의 첫 컬럼. SECS 모델 한정.
  // flowEventIdOptions 가 enable 조건상 isFlowNode || isDcopItemsNode 시점에만 fetch
  // — FlowCard 시점엔 둘 다 false 라 빈 배열. FlowCard 자체가 Socket 일 때 Trigger 미렌더이므로
  // 일치성은 보장. SECS Flow 의 Event dropdown 활성화는 별 SPEC (Identity / Action 우선).
  const flowCardEventOptions = useMemo<readonly { id: string; label: string }[]>(
    () => flowEventIdOptions.map((id) => ({ id, label: id })),
    [flowEventIdOptions],
  )

  const activeFlowMutation = isDraftMode ? createFlowMutation : updateFlowMutation
  const flowSaveStatus: 'idle' | 'saving' | 'error' = activeFlowMutation.isPending
    ? 'saving'
    : activeFlowMutation.isError
      ? 'error'
      : 'idle'
  const flowSaveErrorMessage =
    activeFlowMutation.isError && activeFlowMutation.error instanceof Error
      ? activeFlowMutation.error.message
      : null

  const handleSaveFlow = (payload: ModelFlowUpdateRequest) => {
    if (isDraftMode) {
      // 신규 Flow: POST 로 생성(identity)한 뒤, 사용자가 draft 카드에 입력한 나머지 섹션
      // (Trigger / Filter / actionName / actionDataIndex)을 같은 flowId 로 이어서 PUT 한다 —
      // 한 번의 Save 로 사용자가 기입한 값을 전부 영속한다.
      //
      // dcopItems 는 draft 모드에서 편집 불가(FlowCard 의 isDraftCard 가드)이므로
      // dcopItemKeys=null(Collect 미갱신) 로 보낸다 — Collect 바인딩은 저장 후 별도로 추가한다.
      //
      // actionName 이 비어 있으면 backend updateFlow 가 non-blank 를 요구해 400 이 되므로
      // PUT 을 건너뛰고 POST-only 로 둔다(action_name 은 placeholder "TODO" 로 생성됨 —
      // "빈 Flow 를 만들고 나중에 채우는" 경로를 보존).
      createFlowMutation.mutate(
        { workflowName: payload.workflowName, messageName: payload.messageName },
        {
          onSuccess: (data) => {
            if (payload.actionName.trim().length === 0) {
              clearDraftFlow()
              setSelectedFlowId(data.flowId)
              return
            }
            updateFlowMutation.mutate(
              { flowId: data.flowId, request: { ...payload, dcopItemKeys: null } },
              {
                onSuccess: () => {
                  clearDraftFlow()
                  setSelectedFlowId(data.flowId)
                },
              },
            )
          },
        },
      )
      return
    }
    if (selectedFlowId === null) {
      return
    }
    updateFlowMutation.mutate({ flowId: selectedFlowId, request: payload })
  }

  // ConfirmDialog 확인 시 실제 삭제 — 성공하면 해당 Flow 가 선택돼 있었으면 선택 해제.
  const handleConfirmDeleteFlow = () => {
    if (flowIdToDelete === null) {
      return
    }
    deleteFlowMutation.mutate(flowIdToDelete, {
      onSuccess: () => {
        if (selectedFlowId === flowIdToDelete) {
          setSelectedFlowId(null)
        }
        setFlowIdToDelete(null)
      },
    })
  }

  // 우상단 통합 Save 버튼 클릭 핸들러 — 현재 우측 영역에 FlowCard 가 보이면 그 카드의
  // imperative save() 를 호출 (POST/PUT /flows), 그렇지 않으면 기존 Reference detail
  // PUT 흐름으로 위임합니다. 위치는 한 곳이지만 호출하는 mutation 은 컨텍스트별로 분기.
  const handleTopSave = () => {
    if (isFlowCardVisible) {
      flowCardRef.current?.save()
      return
    }
    onSaveDetailRows()
  }

  // 우상단 Save 의 tooltip — 어떤 영역을 저장하는지 사용자에게 변별값 제공.
  const topSaveTooltip = isFlowCardVisible ? 'Flow 저장' : 'Reference 저장'

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
          'flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4',
          isEditMode && !isLockedByOtherUser ? 'border-input' : null,
        )}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
            {openedTabs.length === 0 ? (
              <span className="text-xs text-muted-foreground">더블 클릭으로 열린 모델 탭이 없습니다.</span>
            ) : (
              openedTabs.map((tab) => (
                <div
                  key={tab.modelVersionKey}
                  className={cn(
                    'flex shrink-0 items-center rounded-lg border',
                    activeTab === tab.modelVersionKey
                      ? 'border-input bg-muted text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTab(tab.modelVersionKey)}
                    className="px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
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
                      'mr-1 inline-flex size-6 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30',
                      activeTab === tab.modelVersionKey
                        ? 'text-foreground hover:bg-muted'
                        : 'text-muted-foreground hover:bg-muted',
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
                className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
                onClick={onUndo}
                disabled={isDetailSavePending || isCheckinPending || isMdfUploadPending || isUndoPending}
              >
                {isUndoPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                )}
                Undo
              </Button>
              {isMdfNode ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
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
                    className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
                    onClick={handleTopSave}
                    disabled={saveDisabled}
                    title={topSaveTooltip}
                    aria-label={topSaveTooltip}
                  >
                    {isFlowCardVisible ? (
                      isFlowSaving ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : null
                    ) : isDetailSavePending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : null}
                    Save
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
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
              className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
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
          <span className={cn(isReadOnly ? 'text-muted-foreground' : 'font-medium text-muted-foreground')}>
            {hintText}
          </span>
        </div>

        {isBranchModel && isLockedByOtherUser ? (
          <p className="mb-3 text-xs text-danger">
            {lockOwner
              ? `${lockOwner}님이 EDIT 모델을 점유하고 있어 수정할 수 없습니다.`
              : '다른 사용자가 EDIT 모델을 점유하고 있어 수정할 수 없습니다.'}
          </p>
        ) : null}

        {actionErrorMessage ? (
          <p className="mb-3 text-xs text-danger">{actionErrorMessage}</p>
        ) : null}

        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
          <aside className="flex w-[260px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-border bg-muted p-2">
            <ModelFlowSidebar
              summaries={messageFlowSummaries}
              selectedFlowId={selectedFlowId}
              onSelectFlow={handleSelectFlow}
              onAddFlow={handleAddFlow}
              onDeleteFlow={(flowId) => setFlowIdToDelete(flowId)}
              isEditable={canEditTableRows}
            />

            <section className="rounded-lg border border-border bg-card p-2">
              <p className="px-1 pb-2 text-xs font-semibold text-foreground">Reference</p>
              <div className="flex flex-col gap-0.5">
                {/* SPEC line 64-65: Reference 영역은 변수 / 리포트 / 이벤트 / MDF / SocketMessage /
                    MesMessage / Parameter — workflow 는 Message Flows 가 대체. */}
                {detailNodes.filter((node) => node !== 'workflow').map((node) => (
                  <button
                    key={node}
                    type="button"
                    onClick={() => {
                      // Reference 노드 선택은 Flow selection / draft 와 상호 배타.
                      setSelectedFlowId(null)
                      onSelectDetailNode(node)
                    }}
                    className={cn(
                      'rounded-md px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30',
                      selectedFlowId === null && !isDraftMode && normalizedDetailNode === node
                        ? 'bg-muted font-semibold text-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {MODEL_DETAIL_NODE_LABELS[node]}
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3">
            {isDraftMode && draftFlow ? (
              <FlowCard
                // draft 카드는 매 startDraftFlow 호출마다 새로 mount — sentinel key 로 안정.
                key="draft-flow"
                ref={flowCardRef}
                flow={draftToFlow(draftFlow)}
                protocol={flowProtocol}
                readOnly={isReadOnly}
                messageOptions={flowCardMessageOptions}
                eventOptions={flowCardEventOptions}
                onSave={handleSaveFlow}
                saveStatus={flowSaveStatus}
                errorMessage={flowSaveErrorMessage}
                onEditFlowFilter={handleEditFlowFilter}
                onEditActionDataIndex={handleFlowEditActionDataIndex}
                onAddDcopItem={handleFlowAddDcopItem}
                onDelete={null}
                onCancelDraft={clearDraftFlow}
              />
            ) : selectedFlowId !== null ? (
              modelFlowDetailQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Flow 데이터를 불러오는 중입니다.</p>
              ) : modelFlowDetailQuery.isError ? (
                <p className="text-sm text-danger">Flow 데이터를 불러오지 못했습니다.</p>
              ) : flowDetail ? (
                <FlowCard
                  key={flowDetail.flowId}
                  ref={flowCardRef}
                  flow={flowDetail}
                  protocol={flowProtocol}
                  readOnly={isReadOnly}
                  messageOptions={flowCardMessageOptions}
                  eventOptions={flowCardEventOptions}
                  onSave={handleSaveFlow}
                  saveStatus={flowSaveStatus}
                  errorMessage={flowSaveErrorMessage}
                  onEditFlowFilter={handleEditFlowFilter}
                  onEditActionDataIndex={handleFlowEditActionDataIndex}
                  onAddDcopItem={handleFlowAddDcopItem}
                  onDelete={() => setFlowIdToDelete(flowDetail.flowId)}
                  onCancelDraft={null}
                />
              ) : (
                <p className="text-sm text-muted-foreground">선택된 Flow 가 없습니다.</p>
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
                    <p className="text-sm text-muted-foreground">MDF 데이터를 불러오는 중입니다.</p>
                  ) : null}

                  {detailErrorMessage ? (
                    <p className="text-sm text-danger">{detailErrorMessage}</p>
                  ) : null}

                  {!isDetailLoading && !detailErrorMessage && mdfContents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">표시할 MDF 데이터가 없습니다.</p>
                  ) : null}

                  {mdfContents.map((content) => (
                    <div
                      key={content.id}
                      className={cn(
                        'flex min-h-0 flex-col space-y-1',
                        mdfContents.length === 1 ? 'flex-1' : null,
                      )}
                    >
                      <p className="text-xs font-medium text-muted-foreground">{`DEFAULT: ${content.name || 'MDF'}`}</p>
                      <textarea
                        readOnly
                        value={content.xml}
                        className="min-h-0 w-full flex-1 resize-none rounded-lg border border-border bg-muted p-3 font-mono text-xs text-foreground focus-visible:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    {MODEL_DETAIL_NODE_LABELS[normalizedDetailNode ?? 'model-parameter']}
                  </h2>

                  {canEditTableRows ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
                      onClick={onAddDetailRow}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      행 추가
                    </Button>
                  ) : null}
                </div>

                {isDetailLoading ? (
                  // W7-B: 옛 분기의 8 행 skeleton UX 보존. SelectableTable 자체에는
                  // loading skeleton 책임 없음 — 호출 바깥에서 분기.
                  <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                    <Table className="min-w-max table-auto">
                      <TableBody>
                        {Array.from({ length: 8 }).map((_, rowIndex) => (
                          <TableRow
                            key={`model-detail-skeleton-${rowIndex}`}
                            data-testid="model-detail-skeleton"
                          >
                            {Array.from({
                              length: visibleColumnCount + (canEditTableRows ? 1 : 0),
                            }).map((_, cellIndex) => (
                              <TableCell key={cellIndex}>
                                <Skeleton className="h-4 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : detailErrorMessage ? (
                  <p className="py-10 text-center text-sm text-danger">
                    {detailErrorMessage}
                  </p>
                ) : (
                  (() => {
                    const detailColumns: ColumnDef<ModelDetailRow>[] =
                      normalizedDetailNode === 'workflow'
                        ? createWorkflowColumns({
                            visibleColumns,
                            detailColumnWidths,
                            isReadOnly,
                            modalPreviewWidth: MODEL_DETAIL_MODAL_PREVIEW_WIDTH,
                            allRows: detailRows,
                            messageOptions: allMessageOptions,
                            eventIdOptions: flowEventIdOptions,
                            onChangeDetailValue,
                            onOpenFlowTextEditor: handleOpenFlowTextEditor,
                            summarizeFlowFilterValue,
                            summarizeActionDataIndexValue,
                          })
                        : normalizedDetailNode === 'dcop-itemes'
                          ? createDcopItemsColumns({
                              visibleColumns,
                              detailColumnWidths,
                              isReadOnly,
                              eventIdOptions: flowEventIdOptions,
                              onChangeDetailValue,
                            })
                          : normalizedDetailNode === 'model-parameter'
                            ? createModelParameterColumns({
                                visibleColumns,
                                detailColumnWidths,
                                isReadOnly,
                                onChangeDetailValue,
                              })
                            : createGenericInputColumns({
                                visibleColumns,
                                detailColumnWidths,
                                isReadOnly,
                                onChangeDetailValue,
                              })

                    const detailActionColumn:
                      | SelectableTableActionColumn<ModelDetailRow>
                      | undefined = canEditTableRows
                      ? {
                          width: '92px',
                          render: (row) => (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-danger"
                              onClick={() => onDeleteDetailRow(row.id)}
                              aria-label={`${row.values[0] || '새 row'} 삭제`}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          ),
                        }
                      : undefined

                    return (
                      <SelectableTable
                        columns={detailColumns}
                        rows={detailRows}
                        rowKey={(row) => row.id}
                        features={{ rangeCopy: true, rangePaste: !isReadOnly }}
                        actionColumn={detailActionColumn}
                        onCellPaste={(row, columnIndex, value) =>
                          onChangeDetailValue(row.id, columnIndex, value)
                        }
                        emptyState={
                          canEditTableRows
                            ? '편집 중인 상세 데이터가 없습니다. 행 추가로 row를 추가하거나 Undo로 체크아웃을 취소해 주세요.'
                            : '표시할 상세 데이터가 없습니다.'
                        }
                        testId={`selectable-table-${normalizedDetailNode ?? 'model-parameter'}`}
                      />
                    )
                  })()
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={flowIdToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFlowIdToDelete(null)
          }
        }}
        title="Flow 를 삭제하시겠습니까?"
        description="선택한 Message Flow 와 그 Collect(DCOP) 바인딩이 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        confirmVariant="destructive"
        isConfirming={deleteFlowMutation.isPending}
        onConfirm={handleConfirmDeleteFlow}
      />

      <FlowFilterEditorModal
        open={isFilterEditorOpen}
        value={flowEditorValue}
        readOnly={isReadOnly}
        titleLabel={flowEditorTitle}
        errorMessage={flowEditorErrorMessage}
        onClose={handleCloseFlowTextEditor}
        onSave={handleSaveFlowTextEditor}
      />

      <ActionDataIndexEditorModal
        open={isActionDataIndexEditorOpen}
        value={flowEditorValue}
        readOnly={isReadOnly}
        titleLabel={flowEditorTitle}
        errorMessage={flowEditorErrorMessage}
        flowMdfContents={flowMdfContents}
        onClose={handleCloseFlowTextEditor}
        onSave={handleSaveFlowTextEditor}
      />

      {/*
        FlowCard 의 [편집...] 모달 — 기존 평면 UI 의 모달 호출 (위 두 개) 과는
        별 state (flowEditor) 로 분리되어 동시 mount 가 안전합니다. FlowCard 의
        draft → raw 직렬화는 FlowCard 내부, 모달 → draft 역변환도 FlowCard 내부
        (handleClickEdit* 의 onChange 콜백). ModelDetailPanel 은 단순 라우터.
      */}
      <FlowFilterEditorModal
        open={flowEditor?.kind === 'workflow-filter'}
        value={flowEditor?.kind === 'workflow-filter' ? flowEditor.value : ''}
        readOnly={isReadOnly}
        titleLabel="Flow Filter"
        errorMessage={null}
        onClose={handleCloseFlowEditor}
        onSave={handleSaveFlowEditor}
      />

      <ActionDataIndexEditorModal
        open={flowEditor?.kind === 'action-data-index'}
        value={flowEditor?.kind === 'action-data-index' ? flowEditor.value : ''}
        readOnly={isReadOnly}
        titleLabel="Action Data Index"
        errorMessage={null}
        flowMdfContents={flowMdfContents}
        onClose={handleCloseFlowEditor}
        onSave={handleSaveFlowEditor}
      />

      {/*
        FlowCard 의 Collect 섹션 "+ DCOP 추가" 클릭 시 열리는 N:M picker 모달.
        flowDetail 이 있어야 binding 편집이 가능 — picker 가 열린 상태에서 다른 Flow
        로 selection 이 바뀌면 부모가 dcopPickerFlowId 를 그대로 두므로 round-trip 후
        새로 열린 picker 가 그 Flow 의 binding 으로 초기화됩니다.
      */}
      <DcopItemPickerModal
        open={dcopPickerFlowId !== null}
        flowId={dcopPickerFlowId ?? 0}
        referenceDcopItems={referenceDcopItems}
        currentFlowDcopItems={flowDetail?.dcopItems ?? []}
        onSave={handleSaveDcopPicker}
        onClose={handleCloseDcopPicker}
      />
    </>
  )
})
