import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clearDeployUiSessionState } from '@/features/deploy/stores/deploy-ui.store'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { useMe } from '@/features/profile/hooks/useProfile'
import { ResizableDivider } from '@/components/ui/resizable-divider'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { clampSidebarWidth } from '@/shared/layout/sidebar-layout'
import { useSharedLayoutStore } from '@/shared/stores/shared-layout.store'
import { useI18n } from '@/i18n/i18n-context'
import { useModelDetail } from '../hooks/useModelDetail'
import { useModelDetailMutations } from '../hooks/useModelDetailMutations'
import { useModelList } from '../hooks/useModelList'
import { useModelManagementMutations } from '../hooks/useModelManagementMutations'
import { useModelNodeDetail } from '../hooks/useModelNodeDetail'
import { useModelMutations } from '../hooks/useModelMutations'
import { useModelUiStore } from '../stores/model-ui.store'
import {
  ModelApiError,
  PLC_DETAIL_NODES,
  PLC_PLACEHOLDER_DETAIL_NODES,
  SECS_DETAIL_NODES,
  SOCKET_DETAIL_NODES,
  type ModelDetailNode,
  type ModelDetailRow,
  type ModelDiffItem,
  type ModelDiffSection,
  type ModelMdfContent,
  type ModelInfo,
  type ModelParentCommitResult,
  type ProtocolType,
} from '../types/model.types'
import { modelApi } from '../api/model.api'
import { BranchModelCreateModal } from './BranchModelCreateModal'
import { ModelCheckInDiffModal } from './ModelCheckInDiffModal'
import { ModelCheckInModal } from './ModelCheckInModal'
import { ModelCreateOrUpdateModal } from './ModelCreateOrUpdateModal'
import {
  ModelDeleteConfirmDialog,
  type ModelDeleteDialogMode,
} from './ModelDeleteConfirmDialog'
import { ModelInfoTable } from './ModelInfoTable'
import { ModelSidebar } from './ModelSidebar'
import { ParentModelCommitModal } from './ParentModelCommitModal'

// 사용자가 모델 버전 frame 진입 시에만 mount. 2007 LOC 패널이라 페이지 초기 청크에서 제외.
const ModelDetailPanel = lazy(() =>
  import('./ModelDetailPanel').then((module) => ({ default: module.ModelDetailPanel })),
)

// ResizableDivider 크기 제한 (%)
const PANEL_MIN_PERCENT = 15
const PANEL_MAX_PERCENT = 85

/**
 * 알 수 없는 오류를 화면 메시지로 변환합니다.
 */
const resolveErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof ModelApiError) {
    return error.payload.errorMsg
  }

  return fallbackMessage
}

/**
 * 상세 데이터 rows를 첫 번째 컬럼 값 기준으로 오름차순 정렬합니다.
 * Model Param, Flow, Dcop Items 등 모든 detail 테이블에 공통 적용됩니다.
 */
const sortDetailRowsByFirstColumn = (rows: ModelDetailRow[]): ModelDetailRow[] =>
  [...rows].sort((a, b) => (a.values[0] ?? '').localeCompare(b.values[0] ?? ''))

/**
 * updatedAt 기준 최신순으로 모델 목록을 정렬합니다.
 */
const sortByUpdatedAtDesc = (models: ModelInfo[]): ModelInfo[] =>
  [...models].sort((firstItem, secondItem) => {
    const secondTime = Date.parse(secondItem.updatedAt)
    const firstTime = Date.parse(firstItem.updatedAt)
    return secondTime - firstTime
  })

/**
 * MDF 노드는 XML 비교가 의미 없으므로 diff 대상에서 제외합니다.
 */
const DIFF_EXCLUDED_NODES: ReadonlySet<ModelDetailNode> = new Set(['mdf'])

/**
 * 두 row 배열을 비교하여 추가/변경/삭제 항목을 도출합니다.
 *
 * identity 기준: values[0] (각 노드의 이름/식별 컬럼)이 비어 있으면 row.id 사용.
 * branchValues = 현재 EDIT 버전 값, parentValues = 이전 저장 버전 값.
 *
 * @param currentRows  현재 EDIT 버전 rows
 * @param previousRows 이전 버전 rows
 * @returns added / changed / deleted 항목 배열
 */
const computeNodeDiff = (
  currentRows: ModelDetailRow[],
  previousRows: ModelDetailRow[],
): Pick<ModelDiffSection, 'added' | 'changed' | 'deleted'> => {
  const toIdentity = (row: ModelDetailRow): string =>
    (row.values[0] ?? '').trim() || row.id

  const currentMap = new Map(currentRows.map((row) => [toIdentity(row), row]))
  const previousMap = new Map(previousRows.map((row) => [toIdentity(row), row]))

  const added: ModelDiffItem[] = []
  const changed: ModelDiffItem[] = []
  const deleted: ModelDiffItem[] = []

  for (const [identity, currentRow] of currentMap) {
    const previousRow = previousMap.get(identity)
    if (!previousRow) {
      added.push({ identity, branchValues: currentRow.values, parentValues: [] })
    } else {
      const isChanged = currentRow.values.some((value, index) => value !== previousRow.values[index])
      if (isChanged) {
        changed.push({ identity, branchValues: currentRow.values, parentValues: previousRow.values })
      }
    }
  }

  for (const [identity, previousRow] of previousMap) {
    if (!currentMap.has(identity)) {
      deleted.push({ identity, branchValues: [], parentValues: previousRow.values })
    }
  }

  return { added, changed, deleted }
}

/**
 * 인터페이스 타입별 상세 노드 기본 집합을 반환합니다.
 */
const resolveDetailNodesByInterface = (commInterface: ProtocolType): ModelDetailNode[] => {
  const normalizedInterface = commInterface.toUpperCase()
  if (normalizedInterface === 'SOCKET') {
    return SOCKET_DETAIL_NODES
  }
  if (normalizedInterface === 'PLC') {
    return PLC_DETAIL_NODES
  }
  return SECS_DETAIL_NODES
}

/**
 * 신규 상세 row에 사용할 임시 식별자입니다.
 */
const createEditableDetailRowId = (): string =>
  `detail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/**
 * 상태 문자열이 DEPRECATED인지 확인합니다.
 */
const isDeprecatedStatus = (status: string): boolean =>
  status.trim().toUpperCase() === 'DEPRECATED'

/**
 * 특정 model_name의 최신 대표 항목을 찾습니다.
 */
const resolveLatestModelByName = (modelItems: ModelInfo[], modelName: string | null): ModelInfo | null => {
  if (!modelName) {
    return null
  }

  return sortByUpdatedAtDesc(modelItems.filter((item) => item.modelName === modelName))[0] ?? null
}

/**
 * 삭제 대상 modelKey 집합에 포함된 모든 version key를 수집합니다.
 */
const collectModelVersionKeysByModelKeys = (
  modelItems: ModelInfo[],
  modelKeys: number[],
): number[] => {
  const targetModelKeySet = new Set(modelKeys)

  return modelItems
    .filter((item) => targetModelKeySet.has(item.modelKey))
    .map((item) => item.modelVersionKey)
}

/**
 * root model 삭제 시 함께 사라지는 branch version key까지 모두 수집합니다.
 */
const collectCascadeDeletedVersionKeys = (
  modelItems: ModelInfo[],
  rootModelName: string,
): number[] =>
  modelItems
    .filter((item) => item.modelName === rootModelName || item.parentModel === rootModelName)
    .map((item) => item.modelVersionKey)

/**
 * Model Info 메인 페이지입니다.
 */
export function ModelPage() {
  const { t } = useI18n()
  const selectedModelVersionKey = useModelUiStore((state) => state.selectedModelVersionKey)
  const openedTabs = useModelUiStore((state) => state.openedTabs)
  const activeTab = useModelUiStore((state) => state.activeTab)
  const detailNode = useModelUiStore((state) => state.detailNode)
  const detailNodeByTab = useModelUiStore((state) => state.detailNodeByTab)
  const isEditMode = useModelUiStore((state) => state.isEditMode)
  const isCheckInModalOpen = useModelUiStore((state) => state.isCheckInModalOpen)
  const isProfileModalOpen = useModelUiStore((state) => state.isProfileModalOpen)
  const setSelectedModelVersionKey = useModelUiStore((state) => state.setSelectedModelVersionKey)
  const openModelTab = useModelUiStore((state) => state.openModelTab)

  // 사이드바 상태는 EQP/Model 페이지 간 공유 store에서 관리합니다.
  const sidebarOpen = useSharedLayoutStore((state) => state.sidebarOpen)
  const sidebarWidth = useSharedLayoutStore((state) => state.sidebarWidth)
  const toggleSidebar = useSharedLayoutStore((state) => state.toggleSidebar)
  const setSidebarWidth = useSharedLayoutStore((state) => state.setSidebarWidth)
  const closeModelTab = useModelUiStore((state) => state.closeModelTab)
  const setActiveTab = useModelUiStore((state) => state.setActiveTab)
  const setDetailNode = useModelUiStore((state) => state.setDetailNode)
  const setDetailNodeForTab = useModelUiStore((state) => state.setDetailNodeForTab)
  const setEditMode = useModelUiStore((state) => state.setEditMode)
  const setCheckInModalOpen = useModelUiStore((state) => state.setCheckInModalOpen)
  const setProfileModalOpen = useModelUiStore((state) => state.setProfileModalOpen)
  const topPanelHeightPercent = useModelUiStore((state) => state.topPanelHeightPercent)
  const setTopPanelHeightPercent = useModelUiStore((state) => state.setTopPanelHeightPercent)
  const handleModelVersionsRemoved = useModelUiStore((state) => state.handleModelVersionsRemoved)
  const resetUiState = useModelUiStore((state) => state.reset)

  const modelListQuery = useModelList()
  const selectedModelDetailQuery = useModelDetail(selectedModelVersionKey)
  const meQuery = useMe(true)

  const { deleteModelMutation, checkoutModelMutation, checkinModelMutation } = useModelMutations()
  const { saveDetailRowsMutation, uploadMdfMutation } = useModelDetailMutations()
  const {
    createRootModelMutation,
    updateRootModelInfoMutation,
    createBranchModelMutation,
    previewParentCommitMutation,
    commitParentModelMutation,
    deleteDeprecatedBranchesMutation,
    deleteModelByKeyMutation,
  } = useModelManagementMutations()

  const [checkInErrorMessage, setCheckInErrorMessage] = useState<string | null>(null)
  const [isCheckInDiffModalOpen, setIsCheckInDiffModalOpen] = useState(false)
  const [isCheckInDiffLoading, setIsCheckInDiffLoading] = useState(false)
  const [checkInDiffSections, setCheckInDiffSections] = useState<ModelDiffSection[]>([])
  const [detailColumnsByContext, setDetailColumnsByContext] = useState<Record<string, string[]>>({})
  const [detailRowsByContext, setDetailRowsByContext] = useState<Record<string, ModelDetailRow[]>>({})
  const [detailMdfByContext, setDetailMdfByContext] = useState<Record<string, ModelMdfContent[]>>({})
  const [rootModalState, setRootModalState] = useState<{
    open: boolean
    mode: 'create' | 'update'
    interfaceType: ProtocolType
    targetModel: ModelInfo | null
  }>({
    open: false,
    mode: 'create',
    interfaceType: 'SECS',
    targetModel: null,
  })
  const [rootModalErrorMessage, setRootModalErrorMessage] = useState<string | null>(null)
  const [branchCreateTargetModel, setBranchCreateTargetModel] = useState<ModelInfo | null>(null)
  const [isBranchCreateModalOpen, setIsBranchCreateModalOpen] = useState(false)
  const [branchCreateErrorMessage, setBranchCreateErrorMessage] = useState<string | null>(null)
  const [parentCommitTargetModel, setParentCommitTargetModel] = useState<ModelInfo | null>(null)
  const [isParentCommitModalOpen, setIsParentCommitModalOpen] = useState(false)
  const [parentCommitPreviewResult, setParentCommitPreviewResult] =
    useState<ModelParentCommitResult | null>(null)
  const [parentCommitErrorMessage, setParentCommitErrorMessage] = useState<string | null>(null)
  const [deleteDialogState, setDeleteDialogState] = useState<{
    open: boolean
    mode: ModelDeleteDialogMode
    targetModel: ModelInfo | null
  }>({
    open: false,
    mode: 'root',
    targetModel: null,
  })
  const [deleteDialogErrorMessage, setDeleteDialogErrorMessage] = useState<string | null>(null)
  const [explicitCheckoutModelVersionKey, setExplicitCheckoutModelVersionKey] = useState<number | null>(null)
  const [selectedInterfaceGroup, setSelectedInterfaceGroup] = useState<ProtocolType | null>(null)

  // 가운데 컨테이너 높이 계산용 ref
  const centerContainerRef = useRef<HTMLDivElement>(null)
  const parentCommitPreviewModelKeyRef = useRef<number | null>(null)

  const currentUserId = meQuery.data?.userId ?? null

  const modelItems = useMemo(() => {
    const baseItems = modelListQuery.data?.items ?? []
    const selectedDetail = selectedModelDetailQuery.data

    if (!selectedDetail) {
      return baseItems
    }

    const hasSelectedInList = baseItems.some(
      (item) => item.modelVersionKey === selectedDetail.modelVersionKey,
    )
    if (!hasSelectedInList) {
      return [selectedDetail, ...baseItems]
    }

    return baseItems.map((item) =>
      item.modelVersionKey === selectedDetail.modelVersionKey ? selectedDetail : item,
    )
  }, [modelListQuery.data, selectedModelDetailQuery.data])

  const selectedModel = useMemo(
    () => modelItems.find((item) => item.modelVersionKey === selectedModelVersionKey) ?? null,
    [modelItems, selectedModelVersionKey],
  )

  const selectedModelRows = useMemo(() => {
    if (!selectedModel) {
      return []
    }

    return sortByUpdatedAtDesc(modelItems.filter((item) => item.modelName === selectedModel.modelName))
  }, [modelItems, selectedModel])

  const interfaceGroupRows = useMemo(() => {
    if (!selectedInterfaceGroup) {
      return []
    }

    const latestRepresentativeByName = new Map<string, ModelInfo>()

    sortByUpdatedAtDesc(
      modelItems.filter((item) => item.commInterface.toUpperCase() === selectedInterfaceGroup.toUpperCase()),
    ).forEach((item) => {
      if (!latestRepresentativeByName.has(item.modelName)) {
        latestRepresentativeByName.set(item.modelName, item)
      }
    })

    return sortByUpdatedAtDesc([...latestRepresentativeByName.values()])
  }, [modelItems, selectedInterfaceGroup])

  const branchCreateSourceVersions = useMemo(() => {
    if (!branchCreateTargetModel) {
      return []
    }

    return sortByUpdatedAtDesc(
      modelItems.filter((item) => item.modelKey === branchCreateTargetModel.modelKey),
    )
  }, [branchCreateTargetModel, modelItems])

  const defaultBranchCreateSourceModelVersionKey = useMemo(() => {
    if (!branchCreateTargetModel) {
      return null
    }

    if (
      selectedModel &&
      selectedModel.modelKey === branchCreateTargetModel.modelKey &&
      !selectedModel.parentModel
    ) {
      return selectedModel.modelVersionKey
    }

    return branchCreateTargetModel.modelVersionKey
  }, [branchCreateTargetModel, selectedModel])

  const parentCommitParentVersions = useMemo(() => {
    const parentModelName =
      parentCommitPreviewResult?.parentModelName ?? parentCommitTargetModel?.parentModel ?? ''

    if (!parentModelName) {
      return []
    }

    return modelItems.filter((item) => item.modelName === parentModelName)
  }, [modelItems, parentCommitPreviewResult?.parentModelName, parentCommitTargetModel?.parentModel])

  const activeTabModel = useMemo(() => {
    if (activeTab === null) {
      return null
    }

    return modelItems.find((item) => item.modelVersionKey === activeTab) ?? null
  }, [activeTab, modelItems])

  // PLC group/register 노드는 조회 백엔드가 없으므로(별 SPEC) 내용 fetch 를 막아 dead 요청을 방지한다.
  // 좌측 트리에 라벨만 렌더하고, 선택 시 패널은 빈 상태로 표시한다.
  const isPlcPlaceholderNode =
    detailNode !== null && PLC_PLACEHOLDER_DETAIL_NODES.has(detailNode)
  const detailNodeQuery = useModelNodeDetail(
    activeTabModel?.modelVersionKey ?? null,
    isPlcPlaceholderNode ? null : detailNode,
  )
  const flowMdfQuery = useModelNodeDetail(
    activeTabModel?.modelVersionKey ?? null,
    activeTabModel && detailNode !== 'mdf' ? 'mdf' : null,
  )

  const editModelForActiveGroup = useMemo(() => {
    if (!activeTabModel) {
      return null
    }

    return (
      modelItems.find(
        (item) =>
          item.modelKey === activeTabModel.modelKey &&
          item.modelVersion.trim().toUpperCase() === 'EDIT',
      ) ?? null
    )
  }, [activeTabModel, modelItems])

  const lockOwner = useMemo(() => {
    if (!editModelForActiveGroup) {
      return null
    }

    const normalizedUpdatedBy = editModelForActiveGroup.updatedBy.trim()
    if (normalizedUpdatedBy.length > 0) {
      return normalizedUpdatedBy
    }

    const normalizedCreatedBy = editModelForActiveGroup.createdBy.trim()
    if (normalizedCreatedBy.length > 0) {
      return normalizedCreatedBy
    }

    return null
  }, [editModelForActiveGroup])

  const isLockedByOtherUser = useMemo(() => {
    if (!editModelForActiveGroup || !lockOwner) {
      return false
    }

    if (!currentUserId) {
      return true
    }

    return lockOwner !== currentUserId
  }, [currentUserId, editModelForActiveGroup, lockOwner])

  /**
   * 활성 탭 기준으로 상세 노드 기본값을 보정합니다.
   */
  useEffect(() => {
    if (!activeTabModel) {
      return
    }

    const detailNodes = resolveDetailNodesByInterface(activeTabModel.commInterface)
    if (detailNodes.length === 0) {
      return
    }

    const defaultNode = detailNodes[0]
    const currentNodeForTab = detailNodeByTab[activeTabModel.modelVersionKey] ?? null

    if (!detailNode || !detailNodes.includes(detailNode)) {
      if (currentNodeForTab !== defaultNode) {
        setDetailNodeForTab(activeTabModel.modelVersionKey, defaultNode)
      }
      return
    }

    if (currentNodeForTab !== detailNode) {
      setDetailNodeForTab(activeTabModel.modelVersionKey, detailNode)
    }
  }, [activeTabModel, detailNode, detailNodeByTab, setDetailNodeForTab])

  /**
   * 활성 컨텍스트(탭 + 노드)에 대한 상세 데이터를 API 응답으로 초기화합니다.
   */
  useEffect(() => {
    if (!activeTabModel || !detailNode || !detailNodeQuery.data) {
      return
    }

    const contextKey = `${activeTabModel.modelVersionKey}:${detailNode}`
    setDetailColumnsByContext((previousColumnsByContext) => {
      if (previousColumnsByContext[contextKey]) {
        return previousColumnsByContext
      }

      return {
        ...previousColumnsByContext,
        [contextKey]: detailNodeQuery.data.columns,
      }
    })

    setDetailRowsByContext((previousRowsByContext) => {
      if (previousRowsByContext[contextKey]) {
        return previousRowsByContext
      }

      return {
        ...previousRowsByContext,
        [contextKey]: sortDetailRowsByFirstColumn(detailNodeQuery.data.rows),
      }
    })

    setDetailMdfByContext((previousMdfByContext) => {
      if (previousMdfByContext[contextKey]) {
        return previousMdfByContext
      }

      return {
        ...previousMdfByContext,
        [contextKey]: detailNodeQuery.data.mdfContents,
      }
    })
  }, [activeTabModel, detailNode, detailNodeQuery.data])

  /**
   * flow editor의 MDF template select가 현재 model의 MDF 목록을 항상 사용할 수 있도록
   * 별도 MDF detail 응답도 캐시에 적재합니다.
   */
  useEffect(() => {
    if (!activeTabModel || !flowMdfQuery.data) {
      return
    }

    const mdfContextKey = `${activeTabModel.modelVersionKey}:mdf`
    setDetailMdfByContext((previousMdfByContext) => {
      if (previousMdfByContext[mdfContextKey]) {
        return previousMdfByContext
      }

      return {
        ...previousMdfByContext,
        [mdfContextKey]: flowMdfQuery.data.mdfContents,
      }
    })
  }, [activeTabModel, flowMdfQuery.data])

  /**
   * 활성 탭이 EDIT 모델인지/소유자인지에 따라 편집 모드를 동기화합니다.
   */
  useEffect(() => {
    if (!activeTabModel) {
      if (isEditMode) {
        setEditMode(false)
      }
      return
    }

    const isEditModel = activeTabModel.modelVersion.trim().toUpperCase() === 'EDIT'
    const isBranchModel = Boolean(activeTabModel.parentModel?.trim())
    const canEdit =
      isBranchModel &&
      isEditModel &&
      explicitCheckoutModelVersionKey === activeTabModel.modelVersionKey &&
      (!lockOwner || (currentUserId !== null && lockOwner === currentUserId))

    if (isEditMode !== canEdit) {
      setEditMode(canEdit)
    }
  }, [
    activeTabModel,
    currentUserId,
    explicitCheckoutModelVersionKey,
    isEditMode,
    lockOwner,
    setEditMode,
  ])

  /**
   * 체크아웃 상태로 기억한 EDIT 버전이 사라졌으면 편집 세션도 함께 정리합니다.
   */
  useEffect(() => {
    if (explicitCheckoutModelVersionKey === null) {
      return
    }

    const checkedOutModel = modelItems.find(
      (item) => item.modelVersionKey === explicitCheckoutModelVersionKey,
    )

    if (
      !checkedOutModel ||
      !checkedOutModel.parentModel?.trim() ||
      checkedOutModel.modelVersion.trim().toUpperCase() !== 'EDIT'
    ) {
      setExplicitCheckoutModelVersionKey(null)
    }
  }, [explicitCheckoutModelVersionKey, modelItems])

  /**
   * 새로고침 또는 백엔드 재연결 후 EDIT 버전이 현재 사용자 소유면 explicitCheckoutModelVersionKey를 복원합니다.
   * canEdit 조건에 explicitCheckoutModelVersionKey 일치 여부가 포함되어 있어,
   * 이 값이 null로 초기화된 상태에서는 isEditMode가 false가 되어 Check Out 버튼이 다시 나타나게 됩니다.
   */
  useEffect(() => {
    if (explicitCheckoutModelVersionKey !== null || !activeTabModel || !currentUserId) {
      return
    }
    const isEditVersion = activeTabModel.modelVersion.trim().toUpperCase() === 'EDIT'
    const isBranchVersion = Boolean(activeTabModel.parentModel?.trim())

    if (isEditVersion && isBranchVersion && lockOwner && lockOwner === currentUserId) {
      setExplicitCheckoutModelVersionKey(activeTabModel.modelVersionKey)
    }
  }, [activeTabModel, currentUserId, explicitCheckoutModelVersionKey, lockOwner])

  /**
   * ResizableDivider 드래그 처리.
   */
  const handleDividerDrag = useCallback((deltaY: number) => {
    setTopPanelHeightPercent((previousPercent) => {
      const containerHeight = centerContainerRef.current?.clientHeight ?? 0
      if (containerHeight === 0) {
        return previousPercent
      }
      const deltaPercent = (deltaY / containerHeight) * 100
      return Math.min(PANEL_MAX_PERCENT, Math.max(PANEL_MIN_PERCENT, previousPercent + deltaPercent))
    })
  }, [setTopPanelHeightPercent])

  const handleSidebarDrag = useCallback(
    (deltaX: number) => {
      if (!sidebarOpen) {
        return
      }

      setSidebarWidth(clampSidebarWidth(sidebarWidth + deltaX))
    },
    [setSidebarWidth, sidebarOpen, sidebarWidth],
  )

  const detailContextKey = useMemo(() => {
    if (!activeTabModel || !detailNode) {
      return null
    }
    return `${activeTabModel.modelVersionKey}:${detailNode}`
  }, [activeTabModel, detailNode])

  const detailColumns = useMemo(() => {
    if (!detailContextKey) {
      return []
    }
    return detailColumnsByContext[detailContextKey] ?? detailNodeQuery.data?.columns ?? []
  }, [detailContextKey, detailColumnsByContext, detailNodeQuery.data?.columns])

  const detailRows = useMemo(() => {
    if (!detailContextKey) {
      return []
    }
    return detailRowsByContext[detailContextKey] ?? detailNodeQuery.data?.rows ?? []
  }, [detailContextKey, detailRowsByContext, detailNodeQuery.data?.rows])

  const detailMdfContents = useMemo(() => {
    if (!detailContextKey) {
      return []
    }
    return detailMdfByContext[detailContextKey] ?? detailNodeQuery.data?.mdfContents ?? []
  }, [detailContextKey, detailMdfByContext, detailNodeQuery.data?.mdfContents])

  const flowMdfContents = useMemo(() => {
    if (!activeTabModel) {
      return []
    }

    const mdfContextKey = `${activeTabModel.modelVersionKey}:mdf`
    return flowMdfQuery.data?.mdfContents ?? detailMdfByContext[mdfContextKey] ?? []
  }, [activeTabModel, detailMdfByContext, flowMdfQuery.data?.mdfContents])

  const hasDetailData = detailRows.length > 0 || detailMdfContents.length > 0
  const detailLoadErrorMessage =
    detailNodeQuery.error && !hasDetailData
      ? resolveErrorMessage(detailNodeQuery.error, t('model.page.detailLoadError'))
      : null

  const handleDetailValueChange = (rowId: string, columnIndex: number, nextValue: string) => {
    if (!detailContextKey) {
      return
    }

    setDetailRowsByContext((previousRowsByContext) => ({
      ...previousRowsByContext,
      [detailContextKey]: (previousRowsByContext[detailContextKey] ?? []).map((row) =>
        row.id === rowId
          ? {
              ...row,
              values: row.values.map((cellValue, index) =>
                index === columnIndex ? nextValue : cellValue,
              ),
              previewValues: row.previewValues.map((cellValue, index) =>
                index === columnIndex ? '' : cellValue,
              ),
            }
          : row,
      ),
    }))
  }

  const handleAddDetailRow = useCallback(() => {
    if (!detailContextKey || detailColumns.length === 0) {
      return
    }

    // dcop-itemes에서 Collection Rule 컬럼의 기본값은 LAST입니다.
    const collectionRuleIndex =
      detailNode === 'dcop-itemes'
        ? detailColumns.findIndex((col) => col === 'Collection Rule')
        : -1

    setDetailRowsByContext((previousRowsByContext) => ({
      ...previousRowsByContext,
      [detailContextKey]: [
        ...(previousRowsByContext[detailContextKey] ?? []),
        {
          id: createEditableDetailRowId(),
          values: detailColumns.map((_, index) => (index === collectionRuleIndex ? 'LAST' : '')),
          previewValues: detailColumns.map(() => ''),
        },
      ],
    }))
    setCheckInErrorMessage(null)
  }, [detailColumns, detailContextKey, detailNode])

  const handleDeleteDetailRow = useCallback((rowId: string) => {
    if (!detailContextKey) {
      return
    }

    setDetailRowsByContext((previousRowsByContext) => ({
      ...previousRowsByContext,
      [detailContextKey]: (previousRowsByContext[detailContextKey] ?? []).filter(
        (row) => row.id !== rowId,
      ),
    }))
    setCheckInErrorMessage(null)
  }, [detailContextKey])

  const handleSaveDetailRows = async () => {
    if (!activeTabModel || !detailNode || detailNode === 'mdf') {
      return
    }

    try {
      setCheckInErrorMessage(null)
      const savedDetail = await saveDetailRowsMutation.mutateAsync({
        modelVersionKey: activeTabModel.modelVersionKey,
        detailNode,
        rows: detailRows,
      })

      if (!detailContextKey) {
        return
      }

      setDetailColumnsByContext((previousColumnsByContext) => ({
        ...previousColumnsByContext,
        [detailContextKey]: savedDetail.columns,
      }))
      setDetailRowsByContext((previousRowsByContext) => ({
        ...previousRowsByContext,
        [detailContextKey]: sortDetailRowsByFirstColumn(savedDetail.rows),
      }))
    } catch (error) {
      setCheckInErrorMessage(resolveErrorMessage(error, t('error.model.saveRows')))
    }
  }

  const handleUploadMdf = async (file: File) => {
    if (!activeTabModel || !detailContextKey) {
      return
    }

    try {
      setCheckInErrorMessage(null)
      const savedMdf = await uploadMdfMutation.mutateAsync({
        modelVersionKey: activeTabModel.modelVersionKey,
        file,
      })

      setDetailMdfByContext((previousMdfByContext) => ({
        ...previousMdfByContext,
        [detailContextKey]: [savedMdf],
      }))
    } catch (error) {
      setCheckInErrorMessage(resolveErrorMessage(error, t('error.model.mdfUpload')))
    }
  }

  /**
   * Sidebar에서 모델명 선택 시 Model 정보 테이블 화면으로 전환합니다.
   */
  const handleSelectModel = (model: ModelInfo) => {
    setSelectedInterfaceGroup(null)
    if (openedTabs.length === 0) {
      setActiveTab(null)
    }
    setSelectedModelVersionKey(model.modelVersionKey)
    setEditMode(false)
    setCheckInModalOpen(false)
    setCheckInErrorMessage(null)
  }

  /**
   * Model 정보 row 더블 클릭 시 Version 화면 탭을 엽니다.
   *
   * 이미 열려 있는 탭을 다시 더블 클릭한 경우 detailNodeByTab[modelVersionKey] 의
   * 이전 선택 노드를 보존합니다 — 탭 간 전환이 각 탭의 마지막 detail 노드를
   * 기억하도록 하는 격리 보장 (store 의 `detailNodeByTab` 의도와 정합).
   */
  const handleOpenModelDetail = (model: ModelInfo) => {
    setSelectedInterfaceGroup(null)
    const alreadyOpened = openedTabs.some(
      (tab) => tab.modelVersionKey === model.modelVersionKey,
    )
    openModelTab(model)
    setSelectedModelVersionKey(model.modelVersionKey)
    setActiveTab(model.modelVersionKey)
    if (!alreadyOpened) {
      const detailNodes = resolveDetailNodesByInterface(model.commInterface)
      if (detailNodes.length > 0) {
        setDetailNodeForTab(model.modelVersionKey, detailNodes[0])
      }
    }
    setCheckInErrorMessage(null)
  }

  const handleSelectTab = (modelVersionKey: number) => {
    setSelectedInterfaceGroup(null)
    setActiveTab(modelVersionKey)
    setSelectedModelVersionKey(modelVersionKey)
    setCheckInErrorMessage(null)
  }

  const handleSelectInterfaceGroup = useCallback(
    (interfaceType: ProtocolType) => {
      setSelectedInterfaceGroup(interfaceType)
      setSelectedModelVersionKey(null)
      setActiveTab(null)
      setEditMode(false)
      setCheckInModalOpen(false)
      setCheckInErrorMessage(null)
    },
    [setActiveTab, setCheckInModalOpen, setEditMode, setSelectedModelVersionKey],
  )

  const handleCloseTab = (modelVersionKey: number) => {
    closeModelTab(modelVersionKey)
    if (explicitCheckoutModelVersionKey === modelVersionKey) {
      setExplicitCheckoutModelVersionKey(null)
      setCheckInModalOpen(false)
      setCheckInErrorMessage(null)
    }
  }

  /**
   * root model 생성/수정 모달을 엽니다.
   */
  const handleOpenRootCreate = (interfaceType: ProtocolType) => {
    setRootModalErrorMessage(null)
    setRootModalState({
      open: true,
      mode: 'create',
      interfaceType,
      targetModel: null,
    })
  }

  const handleOpenRootUpdate = (model: ModelInfo) => {
    setRootModalErrorMessage(null)
    setRootModalState({
      open: true,
      mode: 'update',
      interfaceType: model.commInterface,
      targetModel: model,
    })
  }

  const handleRootModalOpenChange = (open: boolean) => {
    if (!open) {
      setRootModalErrorMessage(null)
    }

    setRootModalState((previousState) => ({
      ...previousState,
      open,
    }))
  }

  const handleSubmitRootModal = async (request: { modelName: string; maker: string | null }) => {
    try {
      setRootModalErrorMessage(null)

      if (rootModalState.mode === 'create') {
        const createdModel = await createRootModelMutation.mutateAsync({
          modelName: request.modelName,
          commInterface: rootModalState.interfaceType,
          maker: request.maker,
        })

        setSelectedModelVersionKey(createdModel.modelVersionKey)
      } else if (rootModalState.targetModel) {
        const updatedModel = await updateRootModelInfoMutation.mutateAsync({
          modelKey: rootModalState.targetModel.modelKey,
          request: {
            maker: request.maker,
          },
        })

        setSelectedModelVersionKey(updatedModel.modelVersionKey)
      }

      setRootModalState((previousState) => ({
        ...previousState,
        open: false,
      }))
    } catch (error) {
      setRootModalErrorMessage(
        resolveErrorMessage(error, t('model.page.rootManageError')),
      )
    }
  }

  /**
   * branch 생성 모달을 엽니다.
   */
  const handleOpenBranchCreate = (model: ModelInfo) => {
    setBranchCreateTargetModel(model)
    setBranchCreateErrorMessage(null)
    setIsBranchCreateModalOpen(true)
  }

  const handleBranchCreateModalOpenChange = (open: boolean) => {
    if (!open) {
      setBranchCreateErrorMessage(null)
    }

    setIsBranchCreateModalOpen(open)
  }

  const handleSubmitBranchCreate = async (request: { suffix: string; sourceModelVersionKey: number }) => {
    if (!branchCreateTargetModel) {
      return
    }

    try {
      setBranchCreateErrorMessage(null)
      const createdBranch = await createBranchModelMutation.mutateAsync({
        modelKey: branchCreateTargetModel.modelKey,
        request,
      })

      setSelectedModelVersionKey(createdBranch.modelVersionKey)
      setIsBranchCreateModalOpen(false)
    } catch (error) {
      setBranchCreateErrorMessage(resolveErrorMessage(error, t('model.page.branchCreateError')))
    }
  }

  /**
   * branch commit preview는 요청 순서가 뒤섞일 수 있어 마지막으로 연 modal만 반영합니다.
   */
  const loadParentCommitPreview = useCallback(
    async (modelKey: number) => {
      parentCommitPreviewModelKeyRef.current = modelKey
      setParentCommitPreviewResult(null)
      setParentCommitErrorMessage(null)

      try {
        const previewResult = await previewParentCommitMutation.mutateAsync(modelKey)
        if (parentCommitPreviewModelKeyRef.current === modelKey) {
          setParentCommitPreviewResult(previewResult)
        }
      } catch (error) {
        if (parentCommitPreviewModelKeyRef.current === modelKey) {
          setParentCommitErrorMessage(resolveErrorMessage(error, t('model.page.parentDiffError')))
        }
      }
    },
    [previewParentCommitMutation, t],
  )

  const handleOpenParentCommit = (model: ModelInfo) => {
    setParentCommitTargetModel(model)
    setParentCommitPreviewResult(null)
    setParentCommitErrorMessage(null)
    setIsParentCommitModalOpen(true)
    void loadParentCommitPreview(model.modelKey)
  }

  const handleParentCommitModalOpenChange = (open: boolean) => {
    if (!open) {
      parentCommitPreviewModelKeyRef.current = null
      setParentCommitPreviewResult(null)
      setParentCommitErrorMessage(null)
    }

    setIsParentCommitModalOpen(open)
  }

  const handleSubmitParentCommit = async (request: { newParentVersion: string }) => {
    if (!parentCommitTargetModel) {
      return
    }

    try {
      setParentCommitErrorMessage(null)
      await commitParentModelMutation.mutateAsync({
        modelKey: parentCommitTargetModel.modelKey,
        request: {
          applyCommit: true,
          newParentVersion: request.newParentVersion,
        },
      })

      parentCommitPreviewModelKeyRef.current = null
      setParentCommitPreviewResult(null)
      setExplicitCheckoutModelVersionKey(null)
      setIsParentCommitModalOpen(false)
    } catch (error) {
      setParentCommitErrorMessage(resolveErrorMessage(error, t('error.model.parentCommit')))
    }
  }

  /**
   * root/branch/deprecated 정리 삭제 확인 다이얼로그를 엽니다.
   */
  const handleOpenDeleteDialog = (mode: ModelDeleteDialogMode, model: ModelInfo) => {
    setDeleteDialogErrorMessage(null)
    setDeleteDialogState({
      open: true,
      mode,
      targetModel: model,
    })
  }

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open) {
      setDeleteDialogErrorMessage(null)
    }

    setDeleteDialogState((previousState) => ({
      ...previousState,
      open,
    }))
  }

  const handleConfirmDelete = async () => {
    const targetModel = deleteDialogState.targetModel
    if (!targetModel) {
      return
    }

    try {
      setDeleteDialogErrorMessage(null)
      let removedVersionKeys: number[] = []
      let fallbackSelectedModelVersionKey: number | null = null

      if (deleteDialogState.mode === 'deprecated-branches') {
        const deleteResult = await deleteDeprecatedBranchesMutation.mutateAsync(targetModel.modelKey)
        removedVersionKeys = collectModelVersionKeysByModelKeys(
          modelItems,
          deleteResult.deletedModelKeys,
        )
        fallbackSelectedModelVersionKey =
          resolveLatestModelByName(modelItems, targetModel.modelName)?.modelVersionKey ?? null
      } else if (deleteDialogState.mode === 'branch') {
        await deleteModelByKeyMutation.mutateAsync({
          modelKey: targetModel.modelKey,
        })
        removedVersionKeys = collectModelVersionKeysByModelKeys(modelItems, [targetModel.modelKey])
        fallbackSelectedModelVersionKey =
          resolveLatestModelByName(modelItems, targetModel.parentModel)?.modelVersionKey ?? null
      } else {
        await deleteModelByKeyMutation.mutateAsync({
          modelKey: targetModel.modelKey,
        })
        removedVersionKeys = collectCascadeDeletedVersionKeys(modelItems, targetModel.modelName)
      }

      handleModelVersionsRemoved(removedVersionKeys, fallbackSelectedModelVersionKey)
      if (
        explicitCheckoutModelVersionKey !== null &&
        removedVersionKeys.includes(explicitCheckoutModelVersionKey)
      ) {
        setExplicitCheckoutModelVersionKey(null)
      }

      setDeleteDialogState((previousState) => ({
        ...previousState,
        open: false,
      }))
    } catch (error) {
      setDeleteDialogErrorMessage(resolveErrorMessage(error, t('error.model.delete')))
    }
  }

  /**
   * branch 관리 액션은 현재 같은 branch를 EDIT 상태로 열어 둔 경우 비활성화합니다.
   */
  const isBranchCommitDisabled = useCallback(
    (model: ModelInfo) => {
      if (isDeprecatedStatus(model.status)) {
        return true
      }

      if (!isEditMode || !activeTabModel) {
        return false
      }

      return activeTabModel.modelKey === model.modelKey
    },
    [activeTabModel, isEditMode],
  )

  const isBranchDeleteDisabled = useCallback(
    (model: ModelInfo) => {
      if (!isEditMode || !activeTabModel) {
        return false
      }

      return activeTabModel.modelKey === model.modelKey
    },
    [activeTabModel, isEditMode],
  )

  const isRootDeleteDisabled = useCallback(
    (model: ModelInfo) => {
      if (!isEditMode || !activeTabModel) {
        return false
      }

      return (
        activeTabModel.modelKey === model.modelKey ||
        activeTabModel.parentModel === model.modelName
      )
    },
    [activeTabModel, isEditMode],
  )

  const isDeprecatedBranchDeleteDisabled = useCallback(
    (model: ModelInfo) =>
      !modelItems.some(
        (item) => item.parentModel === model.modelName && isDeprecatedStatus(item.status),
      ),
    [modelItems],
  )

  const handleCheckOut = async () => {
    if (!activeTabModel) {
      return
    }

    if (!activeTabModel.parentModel?.trim()) {
      setCheckInErrorMessage(t('model.page.rootReadOnly'))
      return
    }

    if (isDeprecatedStatus(activeTabModel.status)) {
      setCheckInErrorMessage(t('model.page.deprecatedNoEdit'))
      return
    }

    try {
      setCheckInErrorMessage(null)
      const checkedOutModel = await checkoutModelMutation.mutateAsync({
        model: activeTabModel,
        currentUserId,
      })

      openModelTab(checkedOutModel)
      setSelectedModelVersionKey(checkedOutModel.modelVersionKey)
      setActiveTab(checkedOutModel.modelVersionKey)

      const detailNodes = resolveDetailNodesByInterface(checkedOutModel.commInterface)
      if (detailNodes.length > 0) {
        setDetailNodeForTab(checkedOutModel.modelVersionKey, detailNodes[0])
      }

      setExplicitCheckoutModelVersionKey(checkedOutModel.modelVersionKey)
      setEditMode(true)
    } catch (error) {
      setCheckInErrorMessage(resolveErrorMessage(error, t('model.page.checkoutError')))
    }
  }

  /**
   * Check In 버튼 클릭 시 diff 모달을 먼저 표시합니다.
   *
   * 이전 버전(non-EDIT)이 없으면 diff 없이 바로 version/description 모달로 이동합니다.
   * 이전 버전이 있으면 현재 EDIT 버전과 이전 버전의 각 노드 데이터를 서버에서 조회하여
   * diff를 계산한 뒤 diff 미리보기 모달을 표시합니다.
   */
  const handleRequestCheckIn = async () => {
    if (!isEditMode || !activeTabModel) {
      return
    }

    setCheckInErrorMessage(null)

    // 이전 버전(EDIT이 아닌 동일 modelKey의 최신 버전) 탐색
    const previousVersionModel = sortByUpdatedAtDesc(
      modelItems.filter(
        (item) =>
          item.modelKey === activeTabModel.modelKey &&
          item.modelVersion.trim().toUpperCase() !== 'EDIT',
      ),
    )[0] ?? null

    if (!previousVersionModel) {
      // 이전 버전이 없으면 diff 없이 바로 check in 모달 표시
      setCheckInModalOpen(true)
      return
    }

    setIsCheckInDiffLoading(true)
    setCheckInDiffSections([])
    setIsCheckInDiffModalOpen(true)

    try {
      const diffNodes = resolveDetailNodesByInterface(activeTabModel.commInterface).filter(
        (node) => !DIFF_EXCLUDED_NODES.has(node),
      )

      // 현재 EDIT 버전과 이전 버전의 모든 노드 데이터를 병렬로 조회합니다.
      const nodeFetchPairs = diffNodes.map(async (node) => {
        const [currentData, previousData] = await Promise.all([
          modelApi.getModelNodeDetail(activeTabModel.modelVersionKey, node),
          modelApi.getModelNodeDetail(previousVersionModel.modelVersionKey, node),
        ])
        return { node, currentData, previousData }
      })

      const results = await Promise.all(nodeFetchPairs)

      const sections: ModelDiffSection[] = results
        .map(({ node, currentData, previousData }) => {
          const { added, changed, deleted } = computeNodeDiff(currentData.rows, previousData.rows)
          return {
            detailNode: node,
            columns: currentData.columns.length > 0 ? currentData.columns : previousData.columns,
            added,
            changed,
            deleted,
          }
        })
        .filter(
          (section) =>
            section.added.length > 0 || section.changed.length > 0 || section.deleted.length > 0,
        )

      setCheckInDiffSections(sections)
    } catch {
      // diff 조회 실패 시 diff 없이 바로 check in 모달로 이동합니다.
      setIsCheckInDiffModalOpen(false)
      setCheckInModalOpen(true)
    } finally {
      setIsCheckInDiffLoading(false)
    }
  }

  /**
   * diff 미리보기 모달에서 OK 클릭 시 설명 입력 모달로 이동합니다.
   */
  const handleCheckInDiffOk = () => {
    setIsCheckInDiffModalOpen(false)
    setCheckInModalOpen(true)
  }

  const handleUndoCheckIn = async () => {
    if (!activeTabModel || activeTabModel.modelVersion.trim().toUpperCase() !== 'EDIT') {
      setCheckInErrorMessage(t('model.page.noEditForUndo'))
      return
    }

    const fallbackModel = sortByUpdatedAtDesc(
      modelItems.filter(
        (item) =>
          item.modelKey === activeTabModel.modelKey &&
          item.modelVersion.trim().toUpperCase() !== 'EDIT',
      ),
    )[0]

    if (!fallbackModel) {
      setCheckInErrorMessage(
        t('model.page.noBaselineForUndo'),
      )
      return
    }

    try {
      setCheckInErrorMessage(null)
      await deleteModelMutation.mutateAsync({
        modelVersionKey: activeTabModel.modelVersionKey,
      })

      closeModelTab(activeTabModel.modelVersionKey)

      if (fallbackModel) {
        openModelTab(fallbackModel)
        setSelectedModelVersionKey(fallbackModel.modelVersionKey)
        setActiveTab(fallbackModel.modelVersionKey)

        const detailNodes = resolveDetailNodesByInterface(fallbackModel.commInterface)
        if (detailNodes.length > 0) {
          setDetailNodeForTab(fallbackModel.modelVersionKey, detailNodes[0])
        }
      } else {
        setActiveTab(null)
      }

      setEditMode(false)
      setExplicitCheckoutModelVersionKey(null)
      setCheckInModalOpen(false)
    } catch (error) {
      setCheckInErrorMessage(resolveErrorMessage(error, t('model.page.undoError')))
    }
  }

  const handleSaveCheckIn = async (description: string) => {
    if (!activeTabModel || activeTabModel.modelVersion.trim().toUpperCase() !== 'EDIT') {
      setCheckInErrorMessage(t('model.page.noEditForCheckin'))
      return
    }

    try {
      setCheckInErrorMessage(null)
      const createdModel = await checkinModelMutation.mutateAsync({
        editModel: activeTabModel,
        description,
        currentUserId,
      })

      closeModelTab(activeTabModel.modelVersionKey)
      openModelTab(createdModel)
      setSelectedModelVersionKey(createdModel.modelVersionKey)
      setActiveTab(createdModel.modelVersionKey)

      const detailNodes = resolveDetailNodesByInterface(createdModel.commInterface)
      if (detailNodes.length > 0) {
        setDetailNodeForTab(createdModel.modelVersionKey, detailNodes[0])
      }

      setEditMode(false)
      setExplicitCheckoutModelVersionKey(null)
      setCheckInModalOpen(false)
    } catch (error) {
      setCheckInErrorMessage(resolveErrorMessage(error, t('model.page.checkinError')))
    }
  }

  const listErrorMessage = modelListQuery.error
    ? resolveErrorMessage(modelListQuery.error, t('model.page.listLoadError'))
    : null

  const isVersionFrame = activeTab !== null && openedTabs.length > 0

  return (
    <AppPageShell
      currentMenu="model"
      onOpenProfile={() => setProfileModalOpen(true)}
      onAfterLogout={() => {
        clearDeployUiSessionState()
        resetUiState()
        setCheckInErrorMessage(null)
        setExplicitCheckoutModelVersionKey(null)
        setDetailColumnsByContext({})
        setDetailRowsByContext({})
        setDetailMdfByContext({})
        setProfileModalOpen(false)
      }}
    >
      <main className="flex flex-1 min-h-0">
        <ModelSidebar
          modelItems={modelItems}
          selectedModelVersionKey={selectedModelVersionKey}
          selectedInterfaceGroup={selectedInterfaceGroup}
          sidebarOpen={sidebarOpen}
          sidebarWidth={sidebarWidth}
          isLoading={modelListQuery.isLoading}
          errorMessage={listErrorMessage}
          onSelectInterfaceGroup={handleSelectInterfaceGroup}
          onSelectModel={handleSelectModel}
          onOpenRootCreate={handleOpenRootCreate}
          onOpenRootUpdate={handleOpenRootUpdate}
          onOpenBranchCreate={handleOpenBranchCreate}
          onOpenDeleteDeprecatedBranches={(model) =>
            handleOpenDeleteDialog('deprecated-branches', model)
          }
          onOpenModelDelete={(model) => handleOpenDeleteDialog('root', model)}
          onOpenParentCommit={handleOpenParentCommit}
          onOpenBranchDelete={(model) => handleOpenDeleteDialog('branch', model)}
          isRootDeleteDisabled={isRootDeleteDisabled}
          isDeprecatedBranchDeleteDisabled={isDeprecatedBranchDeleteDisabled}
          isBranchCommitDisabled={isBranchCommitDisabled}
          isBranchDeleteDisabled={isBranchDeleteDisabled}
          onToggleSidebar={toggleSidebar}
          onResizeSidebar={handleSidebarDrag}
        />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {selectedInterfaceGroup !== null ? (
              <section className="flex flex-1 flex-col p-3 md:p-4">
                <ModelInfoTable
                  models={interfaceGroupRows}
                  isLoading={modelListQuery.isLoading}
                  isFetching={modelListQuery.isFetching}
                  onSelectRow={(modelVersionKey) => {
                    const targetModel =
                      interfaceGroupRows.find((item) => item.modelVersionKey === modelVersionKey) ?? null
                    if (targetModel) {
                      handleSelectModel(targetModel)
                    }
                  }}
                  onOpenDetail={handleOpenModelDetail}
                />
              </section>
            ) : selectedModelVersionKey === null ? (
              <div className="flex flex-1" />
            ) : !isVersionFrame ? (
              <section className="flex flex-1 flex-col p-3 md:p-4">
                <ModelInfoTable
                  models={selectedModelRows}
                  isLoading={modelListQuery.isLoading}
                  isFetching={modelListQuery.isFetching || selectedModelDetailQuery.isFetching}
                  onSelectRow={setSelectedModelVersionKey}
                  onOpenDetail={handleOpenModelDetail}
                />
              </section>
            ) : (
              <div ref={centerContainerRef} className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  style={{ flexBasis: `${topPanelHeightPercent}%` }}
                  className="min-h-0 shrink-0 overflow-auto p-3 pb-0 md:p-4 md:pb-0"
                >
                  <ModelInfoTable
                    models={selectedModelRows}
                    isLoading={modelListQuery.isLoading}
                    isFetching={modelListQuery.isFetching || selectedModelDetailQuery.isFetching}
                    compactHeight
                    onSelectRow={setSelectedModelVersionKey}
                    onOpenDetail={handleOpenModelDetail}
                  />
                </div>

                <ResizableDivider onDrag={handleDividerDrag} />

                <div
                  style={{ flexBasis: `${100 - topPanelHeightPercent}%` }}
                  className="min-h-0 shrink-0 overflow-hidden p-3 pt-0 md:p-4 md:pt-0"
                >
                  <Suspense fallback={null}>
                    <ModelDetailPanel
                      openedTabs={openedTabs}
                      activeTab={activeTab}
                      activeModel={activeTabModel}
                      detailNode={detailNode}
                      detailColumns={detailColumns}
                      detailRows={detailRows}
                      mdfContents={detailMdfContents}
                      flowMdfContents={flowMdfContents}
                      isDetailLoading={detailNodeQuery.isLoading}
                      detailErrorMessage={detailLoadErrorMessage}
                      isEditMode={isEditMode}
                      isLockedByOtherUser={isLockedByOtherUser}
                      lockOwner={lockOwner}
                      isCheckoutPending={checkoutModelMutation.isPending}
                      isCheckinPending={checkinModelMutation.isPending}
                      isUndoPending={deleteModelMutation.isPending}
                      isDetailSavePending={saveDetailRowsMutation.isPending}
                      isMdfUploadPending={uploadMdfMutation.isPending}
                      actionErrorMessage={checkInErrorMessage}
                      onSelectTab={handleSelectTab}
                      onCloseTab={handleCloseTab}
                      onSelectDetailNode={setDetailNode}
                      onChangeDetailValue={handleDetailValueChange}
                      onAddDetailRow={handleAddDetailRow}
                      onDeleteDetailRow={handleDeleteDetailRow}
                      onSaveDetailRows={() => void handleSaveDetailRows()}
                      onUndo={() => void handleUndoCheckIn()}
                      onUploadMdf={(file) => void handleUploadMdf(file)}
                      onCheckOut={() => void handleCheckOut()}
                      onRequestCheckIn={() => void handleRequestCheckIn()}
                    />
                  </Suspense>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <ModelCheckInDiffModal
        open={isCheckInDiffModalOpen}
        isPending={isCheckInDiffLoading}
        diffSections={checkInDiffSections}
        onOpenChange={setIsCheckInDiffModalOpen}
        onCancel={() => setIsCheckInDiffModalOpen(false)}
        onOk={handleCheckInDiffOk}
      />

      <ModelCheckInModal
        open={isCheckInModalOpen}
        isPending={checkinModelMutation.isPending || deleteModelMutation.isPending}
        errorMessage={checkInErrorMessage}
        onOpenChange={setCheckInModalOpen}
        onCancel={() => setCheckInModalOpen(false)}
        onUndo={() => void handleUndoCheckIn()}
        onSave={(description) => void handleSaveCheckIn(description)}
      />

      <ModelCreateOrUpdateModal
        key={`${rootModalState.mode}-${rootModalState.interfaceType}-${rootModalState.targetModel?.modelKey ?? 'new'}-${rootModalState.open ? 'open' : 'closed'}`}
        open={rootModalState.open}
        mode={rootModalState.mode}
        interfaceType={rootModalState.interfaceType}
        targetModel={rootModalState.targetModel}
        isPending={
          rootModalState.mode === 'create'
            ? createRootModelMutation.isPending
            : updateRootModelInfoMutation.isPending
        }
        errorMessage={rootModalErrorMessage}
        onOpenChange={handleRootModalOpenChange}
        onSubmit={(request) => void handleSubmitRootModal(request)}
      />

      <BranchModelCreateModal
        key={`branch-create-${branchCreateTargetModel?.modelKey ?? 'none'}-${isBranchCreateModalOpen ? 'open' : 'closed'}`}
        open={isBranchCreateModalOpen}
        parentModel={branchCreateTargetModel}
        sourceVersions={branchCreateSourceVersions}
        defaultSourceModelVersionKey={defaultBranchCreateSourceModelVersionKey}
        currentUserId={currentUserId}
        isPending={createBranchModelMutation.isPending}
        errorMessage={branchCreateErrorMessage}
        onOpenChange={handleBranchCreateModalOpenChange}
        onSubmit={(request) => void handleSubmitBranchCreate(request)}
      />

      <ParentModelCommitModal
        key={`parent-commit-${parentCommitTargetModel?.modelKey ?? 'none'}-${isParentCommitModalOpen ? 'open' : 'closed'}`}
        open={isParentCommitModalOpen}
        branchModel={parentCommitTargetModel}
        parentVersions={parentCommitParentVersions}
        previewResult={parentCommitPreviewResult}
        isPreviewLoading={previewParentCommitMutation.isPending}
        isCommitPending={commitParentModelMutation.isPending}
        errorMessage={parentCommitErrorMessage}
        onOpenChange={handleParentCommitModalOpenChange}
        onCommit={(request) => void handleSubmitParentCommit(request)}
      />

      <ModelDeleteConfirmDialog
        open={deleteDialogState.open}
        mode={deleteDialogState.mode}
        targetModel={deleteDialogState.targetModel}
        isPending={deleteDeprecatedBranchesMutation.isPending || deleteModelByKeyMutation.isPending}
        errorMessage={deleteDialogErrorMessage}
        onOpenChange={handleDeleteDialogOpenChange}
        onConfirm={() => void handleConfirmDelete()}
      />

      <UserProfileModal open={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </AppPageShell>
  )
}
