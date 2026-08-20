import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clearDeployUiSessionState } from '@/features/deploy/stores/deploy-ui.store'
import { useMe } from '@/features/profile/hooks/useProfile'
import { ResizableDivider } from '@/components/ui/resizable-divider'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { AppPageHeading } from '@/shared/layout/AppPageHeading'
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
import { computeNodeDiff } from '../lib/model-diff.util'
import {
  type ModelDetailRow,
  type ModelDiffSection,
  type ModelMdfContent,
  type ModelInfo,
  type ModelParentCommitResult,
  type ProtocolType,
} from '../types/model.types'
import {
  collectCascadeDeletedVersionKeys,
  collectModelVersionKeysByModelKeys,
  createEditableDetailRowId,
  DIFF_EXCLUDED_NODES,
  isDeprecatedStatus,
  resolveDetailNodesByInterface,
  resolveLatestModelByName,
  sortByUpdatedAtDesc,
  sortDetailRowsByFirstColumn,
} from '../lib/model-page-helpers'
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
import { ApiError } from '@/shared/lib/api-error'

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
  if (error instanceof ApiError) {
    return error.payload.errorMsg
  }

  return fallbackMessage
}

interface ModelPageProps {
  /** 표시할 인터페이스 스코프. 라우트가 정한다 — URL 이 단일 진실 원천이다. */
  scope: ProtocolType
}

/**
 * Model Info 메인 페이지입니다.
 *
 * 인터페이스 스코프(SECS / Socket / PLC)는 라우트가 정한다. 모델 탭을 열면 그 탭이 화면을
 * 차지하고, 스코프 목록으로 돌아가는 수단은 LNB navigate 다.
 */
export function ModelPage({ scope }: ModelPageProps) {
  const { t } = useI18n()
  const selectedModelVersionKey = useModelUiStore((state) => state.selectedModelVersionKey)
  const openedTabs = useModelUiStore((state) => state.openedTabs)
  const activeTab = useModelUiStore((state) => state.activeTab)
  const detailNode = useModelUiStore((state) => state.detailNode)
  const detailNodeByTab = useModelUiStore((state) => state.detailNodeByTab)
  const isEditMode = useModelUiStore((state) => state.isEditMode)
  const isCheckInModalOpen = useModelUiStore((state) => state.isCheckInModalOpen)
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
  /**
   * 모달을 열 때마다 1 씩 오르는 회차 번호. 폼 초기화용 React key 의 재료다.
   *
   * 왜 `open` 이 아니라 이것인가 — key 에 `open` 을 넣으면 **닫는 순간에도** key 가 바뀌어
   * React 가 Dialog 서브트리를 통째로 교체한다. 그러면 Radix 가 열 때 `document.body` 에 건
   * `pointer-events: none` 을 되돌리지 못하고, 그 뒤 페이지 전체가 클릭을 받지 못한다
   * (2026-08-10 실측 — 모달을 닫으면 사이드바가 먹통). 여는 순간에만 올리면 폼 초기화는
   * 그대로 유지되면서 닫을 때의 교체가 사라진다.
   */
  const [modalOpenSeq, setModalOpenSeq] = useState(0)
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
    if (!scope) {
      return []
    }

    const latestRepresentativeByName = new Map<string, ModelInfo>()

    sortByUpdatedAtDesc(
      modelItems.filter((item) => item.commInterface.toUpperCase() === scope.toUpperCase()),
    ).forEach((item) => {
      if (!latestRepresentativeByName.has(item.modelName)) {
        latestRepresentativeByName.set(item.modelName, item)
      }
    })

    return sortByUpdatedAtDesc([...latestRepresentativeByName.values()])
  }, [modelItems, scope])

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

  const detailNodeQuery = useModelNodeDetail(
    activeTabModel?.modelVersionKey ?? null,
    detailNode,
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
   * effect 대신 render 중 조건부 조정 — contextKey 가 채워지면 조건이 풀려 수렴합니다.
   */
  if (activeTabModel && detailNode && detailNodeQuery.data) {
    const contextKey = `${activeTabModel.modelVersionKey}:${detailNode}`
    const queryData = detailNodeQuery.data

    if (!detailColumnsByContext[contextKey]) {
      setDetailColumnsByContext((previousColumnsByContext) => ({
        ...previousColumnsByContext,
        [contextKey]: queryData.columns,
      }))
    }

    if (!detailRowsByContext[contextKey]) {
      setDetailRowsByContext((previousRowsByContext) => ({
        ...previousRowsByContext,
        [contextKey]: sortDetailRowsByFirstColumn(queryData.rows),
      }))
    }

    if (!detailMdfByContext[contextKey]) {
      setDetailMdfByContext((previousMdfByContext) => ({
        ...previousMdfByContext,
        [contextKey]: queryData.mdfContents,
      }))
    }
  }

  /**
   * flow editor의 MDF template select가 현재 model의 MDF 목록을 항상 사용할 수 있도록
   * 별도 MDF detail 응답도 캐시에 적재합니다. (render 중 조건부 조정 — 위와 동일한 수렴 구조)
   */
  if (activeTabModel && flowMdfQuery.data) {
    const mdfContextKey = `${activeTabModel.modelVersionKey}:mdf`
    const flowMdfContents = flowMdfQuery.data.mdfContents

    if (!detailMdfByContext[mdfContextKey]) {
      setDetailMdfByContext((previousMdfByContext) => ({
        ...previousMdfByContext,
        [mdfContextKey]: flowMdfContents,
      }))
    }
  }

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
   * render 중 조건부 조정 — null 로 정리되면 조건이 풀려 수렴합니다.
   */
  if (explicitCheckoutModelVersionKey !== null) {
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
  } else if (activeTabModel && currentUserId) {
    /*
     * 새로고침 또는 백엔드 재연결 후 EDIT 버전이 현재 사용자 소유면 explicitCheckoutModelVersionKey를 복원합니다.
     * canEdit 조건에 explicitCheckoutModelVersionKey 일치 여부가 포함되어 있어,
     * 이 값이 null로 초기화된 상태에서는 isEditMode가 false가 되어 Check Out 버튼이 다시 나타나게 됩니다.
     * (복원되면 explicitCheckoutModelVersionKey !== null 이 되어 이 분기를 다시 타지 않습니다.)
     */
    const isEditVersion = activeTabModel.modelVersion.trim().toUpperCase() === 'EDIT'
    const isBranchVersion = Boolean(activeTabModel.parentModel?.trim())

    if (isEditVersion && isBranchVersion && lockOwner && lockOwner === currentUserId) {
      setExplicitCheckoutModelVersionKey(activeTabModel.modelVersionKey)
    }
  }

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
    setActiveTab(modelVersionKey)
    setSelectedModelVersionKey(modelVersionKey)
    setCheckInErrorMessage(null)
  }

  /**
   * 스코프 진입 시 이전 스코프에서 고른 모델 선택을 정리합니다.
   *
   * 선택(`selectedModelVersionKey`)은 store 에 남으므로 SECS 에서 모델을 고른 뒤 Socket 으로
   * 옮기면 Socket 트리에 없는 모델의 버전 목록이 그려진다. 스코프는 URL 이 정하므로 어긋난
   * 선택을 지우고 그 스코프의 목록에서 다시 시작한다 — 구 섹션 헤더 클릭이 하던 정리와 같다.
   *
   * store 상태만 지운다. 이 페이지는 경로가 바뀔 때마다 remount 되므로(`Router` 의
   * `ErrorBoundary key={pathname}`) React 로컬 상태는 이미 초기값이다.
   */
  useEffect(() => {
    setSelectedModelVersionKey(null)
    setActiveTab(null)
    setEditMode(false)
    setCheckInModalOpen(false)
  }, [scope, setActiveTab, setCheckInModalOpen, setEditMode, setSelectedModelVersionKey])

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
    setModalOpenSeq((previousSeq) => previousSeq + 1)
    setRootModalState({
      open: true,
      mode: 'create',
      interfaceType,
      targetModel: null,
    })
  }

  const handleOpenRootUpdate = (model: ModelInfo) => {
    setRootModalErrorMessage(null)
    setModalOpenSeq((previousSeq) => previousSeq + 1)
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
    setModalOpenSeq((previousSeq) => previousSeq + 1)
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
    setModalOpenSeq((previousSeq) => previousSeq + 1)
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
          const { added, changed, deleted } = computeNodeDiff(node, currentData.rows, previousData.rows)
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
    <AppShellPage
      onAfterLogout={() => {
        clearDeployUiSessionState()
        resetUiState()
        setCheckInErrorMessage(null)
        setExplicitCheckoutModelVersionKey(null)
        setDetailColumnsByContext({})
        setDetailRowsByContext({})
        setDetailMdfByContext({})
      }}
    >
      <main className="flex flex-1 min-h-0">
        <ModelSidebar
          scope={scope}
          modelItems={modelItems}
          selectedModelVersionKey={selectedModelVersionKey}
          sidebarOpen={sidebarOpen}
          sidebarWidth={sidebarWidth}
          isLoading={modelListQuery.isLoading}
          errorMessage={listErrorMessage}
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
          <AppPageHeading className="px-3 pt-3 md:px-4 md:pt-4" />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* 모델을 고르기 전에는 현재 라우트 스코프의 모델 목록을 보여준다 — 스코프가 URL 로
                항상 정해지므로 구 "선택 없음" 빈 화면 분기는 이 목록이 대신한다. */}
            {selectedModelVersionKey === null ? (
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
        key={`${rootModalState.mode}-${rootModalState.interfaceType}-${rootModalState.targetModel?.modelKey ?? 'new'}-${modalOpenSeq}`}
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
        key={`branch-create-${branchCreateTargetModel?.modelKey ?? 'none'}-${modalOpenSeq}`}
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
        key={`parent-commit-${parentCommitTargetModel?.modelKey ?? 'none'}-${modalOpenSeq}`}
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

    </AppShellPage>
  )
}
