import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SELECT_EMPTY_VALUE,
} from '@/components/ui/select'
import { useI18n } from '@/i18n/i18n-context'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { useAsyncCommandGuard } from '@/shared/hooks/useAsyncCommandGuard'
import { clampSidebarWidth } from '@/shared/layout/sidebar-layout'
import { useSharedLayoutStore } from '@/shared/stores/shared-layout.store'
import { CheckInModal } from './CheckInModal'
import type { EqpParamDiffRow } from './CheckInModal'
import { BusinessGroupModelTable } from './BusinessGroupModelTable'
import { EqpDeleteConfirmDialog } from './EqpDeleteConfirmDialog'
import { EqpDeleteResultDialog } from './EqpDeleteResultDialog'
import { EqpInfoTable } from './EqpInfoTable'
import { EqpPollingGroupControl } from './EqpPollingGroupControl'
import { EqpLifecycleActionDialog } from './EqpLifecycleActionDialog'
import { EqpLifecycleResultDialog } from './EqpLifecycleResultDialog'
import { EqpModelBindingModal } from './EqpModelBindingModal'
import { ApiError } from '@/shared/lib/api-error'

// 사용자가 "등록 / 정보" 누른 시점에만 mount. 1275 LOC 모달이라 페이지 초기 청크에서 제외.
const EqpManageFormModal = lazy(() =>
  import('./EqpManageFormModal').then((module) => ({ default: module.EqpManageFormModal })),
)
import { EqpParamTable } from './EqpParamTable'
import { EqpSidebar } from './EqpSidebar'
import { GatewayGroupTable } from './GatewayGroupTable'
import { ResizableDivider } from '@/components/ui/resizable-divider'
import { clearDeployUiSessionState } from '@/features/deploy/stores/deploy-ui.store'
import { eqpApi } from '../api/eqp.api'
import { useEqpDetail } from '../hooks/useEqpDetail'
import { useEqpList } from '../hooks/useEqpList'
import { useGatewayShardLeases } from '../hooks/useGatewayShardLeases'
import { useEqpModelInfo } from '../hooks/useEqpModelInfo'
import { useEqpParamVersions } from '../hooks/useEqpParamVersions'
import { useEqpRuntimeState } from '../hooks/useEqpRuntimeState'
import { useEqpCheckoutStatus } from '../hooks/useEqpCheckoutStatus'
import { useEqpManageDetail } from '../hooks/useEqpManageDetail'
import { useEqpManageOptions } from '../hooks/useEqpManageOptions'
import { useEqpMutations } from '../hooks/useEqpMutations'
import { useEqpParams } from '../hooks/useEqpParams'
import { useEqpParamMutations } from '../hooks/useEqpParamMutations'
import { eqpQueryKeys, invalidateEqpSelectionQueries } from '../lib/eqp-query-keys'
import { useEqpUiStore } from '../stores/eqp-ui.store'
import {
  type EqpCreateRequest,
  type EqpInfo,
  type EqpParamRow,
  type EqpUpdateRequest,
  type ProtocolType,
} from '../types/eqp.types'
import { groupEqpItems } from '../utils/eqp-group.util'
import { isActiveEquipment } from '../utils/eqp-runtime-state.util'
import { useMe } from '@/features/profile/hooks/useProfile'
import { useLineList } from '@/shared/hooks/useLineList'
import { useLineScopeStore } from '@/shared/stores/line-scope.store'
import { useModelList } from '@/features/model/hooks/useModelList'
import { modelQueryKeys } from '@/features/model/lib/model-query-keys'
import type { ModelInfo } from '@/features/model/types/model.types'

const EMPTY_VERSION_VALUE = ''

// ResizableDivider 크기 제한 (%)
const PANEL_MIN_PERCENT = 15
const PANEL_MAX_PERCENT = 85

type EditableEqpParamRow = EqpParamRow & { rowId: string }

type EqpManagementDialogState =
  | { type: 'none' }
  | { type: 'create'; interfaceType: ProtocolType }
  | { type: 'info'; eqpId: string }
  | { type: 'model'; eqpId: string }
  | { type: 'delete'; eqpId: string }

interface EqpDeleteResultDialogState {
  open: boolean
  status: 'success' | 'failure'
  eqpId: string | null
  message: string | null
}

type EqpLifecycleAction = 'start' | 'end' | 'restart' | 'reconnect'

interface EqpLifecycleDialogState {
  open: boolean
  action: EqpLifecycleAction
  eqp: EqpInfo | null
}

interface EqpLifecycleResultDialogState {
  open: boolean
  status: 'success' | 'failure'
  action: EqpLifecycleAction
  eqpId: string | null
  message: string | null
}

const EMPTY_MANAGEMENT_DIALOG_STATE: EqpManagementDialogState = { type: 'none' }
const EMPTY_EQP_DELETE_RESULT_DIALOG_STATE: EqpDeleteResultDialogState = {
  open: false,
  status: 'success',
  eqpId: null,
  message: null,
}
const EMPTY_EQP_LIFECYCLE_DIALOG_STATE: EqpLifecycleDialogState = {
  open: false,
  action: 'start',
  eqp: null,
}
const EMPTY_EQP_LIFECYCLE_RESULT_DIALOG_STATE: EqpLifecycleResultDialogState = {
  open: false,
  status: 'success',
  action: 'start',
  eqpId: null,
  message: null,
}
const EQP_ASYNC_POLL_INTERVAL_MS = 1000
const EQP_ASYNC_MAX_ATTEMPTS = 60
const PASSIVE_LIFECYCLE_UNSUPPORTED_KEY = 'eqp.lifecycle.passiveUnsupported'

/**
 * 편집 중인 파라미터 행을 안정적으로 식별하기 위한 임시 키를 생성합니다.
 * paramName은 사용자가 수정할 수 있으므로 React key와 수정 대상 식별자로 사용할 수 없습니다.
 */
const createEditableParamRowId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `eqp-param-row-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * API 파라미터 행을 편집 가능한 로컬 행 모델로 변환합니다.
 */
const toEditableParamRow = (row: EqpParamRow): EditableEqpParamRow => ({
  rowId: createEditableParamRowId(),
  ...row,
})

/**
 * 알 수 없는 오류를 화면 메시지로 변환합니다.
 */
const resolveErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof ApiError) {
    return error.payload.errorMsg
  }

  return fallbackMessage
}

/**
 * EQP 목록 항목의 최소 유효성(eqpId 문자열)을 확인합니다.
 */
const isEqpInfoItem = (value: unknown): value is EqpInfo =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { eqpId?: unknown }).eqpId === 'string' &&
  (value as { eqpId: string }).eqpId.length > 0

/**
 * 목록 payload를 화면에서 안전하게 사용할 수 있는 EQP 배열로 정규화합니다.
 */
const resolveEqpItems = (payload: unknown): EqpInfo[] => {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    return payload.filter(isEqpInfoItem)
  }

  if (typeof payload === 'object' && payload !== null) {
    const items = (payload as { items?: unknown }).items
    if (Array.isArray(items)) {
      return items.filter(isEqpInfoItem)
    }
  }

  return []
}

const normalizeParamText = (value: string | null | undefined): string => value ?? ''

const computeEqpParamDiffRows = (
  branchRows: readonly EqpParamRow[],
  parentRows: readonly EqpParamRow[],
): EqpParamDiffRow[] => {
  const parentByName = new Map<string, EqpParamRow>()
  const branchByName = new Map<string, EqpParamRow>()

  parentRows.forEach((row) => {
    const paramName = row.paramName.trim()
    if (paramName) {
      parentByName.set(paramName, {
        ...row,
        paramName,
        paramValue: normalizeParamText(row.paramValue),
        description: normalizeParamText(row.description),
      })
    }
  })

  branchRows.forEach((row) => {
    const paramName = row.paramName.trim()
    if (paramName) {
      branchByName.set(paramName, {
        ...row,
        paramName,
        paramValue: normalizeParamText(row.paramValue),
        description: normalizeParamText(row.description),
      })
    }
  })

  const diffRows: EqpParamDiffRow[] = []

  branchByName.forEach((branchRow, paramName) => {
    const parentRow = parentByName.get(paramName)

    if (!parentRow) {
      diffRows.push({
        status: 'added',
        paramName,
        parentValue: '',
        branchValue: branchRow.paramValue,
        parentDescription: '',
        branchDescription: branchRow.description,
      })
      return
    }

    if (
      parentRow.paramValue !== branchRow.paramValue ||
      parentRow.description !== branchRow.description
    ) {
      diffRows.push({
        status: 'changed',
        paramName,
        parentValue: parentRow.paramValue,
        branchValue: branchRow.paramValue,
        parentDescription: parentRow.description,
        branchDescription: branchRow.description,
      })
    }
  })

  parentByName.forEach((parentRow, paramName) => {
    if (branchByName.has(paramName)) {
      return
    }

    diffRows.push({
      status: 'deleted',
      paramName,
      parentValue: parentRow.paramValue,
      branchValue: '',
      parentDescription: parentRow.description,
      branchDescription: '',
    })
  })

  const statusOrder: Record<EqpParamDiffRow['status'], number> = {
    added: 0,
    changed: 1,
    deleted: 2,
  }

  return diffRows.sort((left, right) => {
    const statusCompare = statusOrder[left.status] - statusOrder[right.status]
    return statusCompare === 0 ? left.paramName.localeCompare(right.paramName) : statusCompare
  })
}

/** 설비 페이지의 1단계 스코프 — 확정 메뉴 트리의 `/eqp/business` · `/eqp/gateway` 와 1:1. */
export type EqpScope = 'business' | 'gateway'

interface EqpPageProps {
  /** 표시할 스코프. 라우트가 정한다. */
  scope: EqpScope
}

/**
 * EQP Info 메인 페이지입니다.
 * DB 기반 Check Out / Save / Check In 흐름을 처리합니다.
 *
 * 체크아웃 잠금: tc_eqp_param.param_version='EDIT' 존재 여부 = 체크아웃 상태
 *
 * 선택 상태:
 * - none: 초기 진입 / 선택 없음 → 가운데 영역 비어있음
 * - gateway_all: Gateway 클릭 → 전체 게이트웨이 설비 목록 테이블 표시
 * - gateway_group: gateway_app 그룹 클릭 → 해당 그룹 설비 목록 테이블 표시
 * - business_group: business_app 그룹 클릭 → 해당 그룹 설비가 참조하는 모델 목록 테이블 표시
 * - eqp: 개별 설비 클릭 → 설비 정보 + ResizableDivider + 파라미터/Checkout 영역 표시
 *
 * 스코프(Business / Gateway)는 라우트가 정한다 — URL 이 단일 진실 원천이다. store 의 selection 은
 * 스코프 안의 세부 선택(그룹 / 개별 설비)만 담고, 스코프와 어긋나면 진입 시 보정된다.
 */
export function EqpPage({ scope }: EqpPageProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const selection = useEqpUiStore((state) => state.selection)
  const isEditMode = useEqpUiStore((state) => state.isEditMode)
  const selectEqp = useEqpUiStore((state) => state.selectEqp)
  const selectGatewayAll = useEqpUiStore((state) => state.selectGatewayAll)
  const selectBusinessAll = useEqpUiStore((state) => state.selectBusinessAll)
  const selectGatewayGroup = useEqpUiStore((state) => state.selectGatewayGroup)
  const selectBusinessGroup = useEqpUiStore((state) => state.selectBusinessGroup)
  const clearSelection = useEqpUiStore((state) => state.clearSelection)
  const setEditMode = useEqpUiStore((state) => state.setEditMode)
  const topPanelHeightPercent = useEqpUiStore((state) => state.topPanelHeightPercent)
  const setTopPanelHeightPercent = useEqpUiStore((state) => state.setTopPanelHeightPercent)

  // 사이드바 상태는 EQP/Model 페이지 간 공유 store에서 관리합니다.
  const sidebarOpen = useSharedLayoutStore((state) => state.sidebarOpen)
  const sidebarWidth = useSharedLayoutStore((state) => state.sidebarWidth)
  const toggleSidebar = useSharedLayoutStore((state) => state.toggleSidebar)
  const setSidebarWidth = useSharedLayoutStore((state) => state.setSidebarWidth)

  // selection에서 현재 선택된 eqpId 파생 (eqp 타입일 때만 유효)
  const selectedEqpId = selection.type === 'eqp' ? selection.eqpId : null
  // 권한 게이팅이 항상 판정해야 하므로 상시 활성 — RequireAuth 와 같은 query key 라 요청은 dedup 된다.
  const meQuery = useMe(true)
  const currentUserId = meQuery.data?.userId ?? null

  const eqpListQuery = useEqpList()
  const gatewayShardLeasesQuery = useGatewayShardLeases()
  const modelListQuery = useModelList()
  const lineListQuery = useLineList()
  const selectedLineValue = useLineScopeStore((state) => state.selectedLineValue)
  // 상단 라인 선택(lineCode)을 lineKey 로 해석 — 라인 스코프 필터 기준 (LiveMapPage 와 동일 방식).
  const selectedLineKey = useMemo(
    () => lineListQuery.data?.find((line) => line.lineCode === selectedLineValue)?.lineKey ?? null,
    [lineListQuery.data, selectedLineValue],
  )
  const eqpDetailQuery = useEqpDetail(selectedEqpId)
  const eqpParamVersionsQuery = useEqpParamVersions(selectedEqpId)
  const eqpRuntimeStateQuery = useEqpRuntimeState(selectedEqpId)
  const eqpModelInfoQuery = useEqpModelInfo(
    eqpDetailQuery.data && eqpDetailQuery.data.modelVersionKey > 0
      ? eqpDetailQuery.data.modelVersionKey
      : null,
  )
  const selectedEqpManageDetailQuery = useEqpManageDetail(selectedEqpId, Boolean(selectedEqpId))

  const checkoutStatusQuery = useEqpCheckoutStatus(selectedEqpId)

  // 읽기 모드: 선택된 버전 파라미터 조회
  const [appliedVersion, setAppliedVersion] = useState(EMPTY_VERSION_VALUE)
  const readParamsQuery = useEqpParams(
    selectedEqpId,
    !isEditMode && appliedVersion ? appliedVersion : null,
  )

  // 편집 모드: EDIT 버전 파라미터 조회
  const editParamsQuery = useEqpParams(
    selectedEqpId,
    isEditMode ? 'EDIT' : null,
  )
  const checkInBaseParamsQuery = useEqpParams(
    selectedEqpId,
    isEditMode && appliedVersion ? appliedVersion : null,
  )

  // 편집 중 로컬 상태 (편집 내용을 임시 보관)
  const [localEditRows, setLocalEditRows] = useState<EditableEqpParamRow[]>([])
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false)
  const [checkInErrorMessage, setCheckInErrorMessage] = useState<string | null>(null)
  const [managementDialog, setManagementDialog] = useState<EqpManagementDialogState>(
    EMPTY_MANAGEMENT_DIALOG_STATE,
  )
  const [managementErrorMessage, setManagementErrorMessage] = useState<string | null>(null)
  const [deleteResultDialog, setDeleteResultDialog] = useState<EqpDeleteResultDialogState>(
    EMPTY_EQP_DELETE_RESULT_DIALOG_STATE,
  )
  const [lifecycleDialog, setLifecycleDialog] = useState<EqpLifecycleDialogState>(
    EMPTY_EQP_LIFECYCLE_DIALOG_STATE,
  )
  const [lifecycleResultDialog, setLifecycleResultDialog] = useState<EqpLifecycleResultDialogState>(
    EMPTY_EQP_LIFECYCLE_RESULT_DIALOG_STATE,
  )
  const [lifecycleErrorMessage, setLifecycleErrorMessage] = useState<string | null>(null)

  // 가운데 컨테이너 높이 계산용 ref
  const centerContainerRef = useRef<HTMLDivElement>(null)
  // 체크아웃 중복 요청(더블 클릭) 방지용 로컬 가드
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState(false)
  const isCheckoutSubmittingRef = useRef(false)
  // 202 + 폴링으로 완결되는 명령의 in-flight 가드 — 폴링 구간까지 재진입을 막는다.
  const lifecycleGuard = useAsyncCommandGuard()
  const pollingGroupGuard = useAsyncCommandGuard()

  const {
    createEqpMutation,
    updateEqpMutation,
    deleteEqpMutation,
    startEqpMutation,
    endEqpMutation,
    reconnectEqpMutation,
    startPollingGroupMutation,
    endPollingGroupMutation,
  } = useEqpMutations()
  const { checkoutMutation, saveEditParamsMutation, undoCheckoutMutation, checkinMutation } =
    useEqpParamMutations()
  const allEqpItems = useMemo(() => resolveEqpItems(eqpListQuery.data as unknown), [eqpListQuery.data])
  // 선택 라인 소속 설비만 노출한다 — lineKey 미해석(라인 목록 로딩/선택 시드 전)이면 빈 목록.
  const eqpItems = useMemo(
    () => (selectedLineKey === null ? [] : allEqpItems.filter((item) => item.lineKey === selectedLineKey)),
    [allEqpItems, selectedLineKey],
  )
  // "EDIT"은 체크아웃 잠금용 내부 버전이므로 드롭다운에서 제외합니다.
  // "EDIT"을 sourceVersion으로 체크아웃하면 기존 EDIT 행과 중복 키 충돌이 발생합니다.
  const versionOptions = useMemo(
    () =>
      Array.from(new Set((eqpParamVersionsQuery.data ?? []).map((version) => version.trim()))).filter(
        (v) => Boolean(v) && v !== 'EDIT',
      ),
    [eqpParamVersionsQuery.data],
  )

  const checkoutStatus = useMemo(() => ({
    isCheckedOut: checkoutStatusQuery.data?.isCheckedOut ?? false,
    checkedOutBy: checkoutStatusQuery.data?.checkedOutBy ?? null,
  }), [checkoutStatusQuery.data])
  const isCheckedOutByCurrentUser = useMemo(() => {
    if (!checkoutStatus.isCheckedOut) {
      return false
    }

    // NOTE: checkedOutBy가 null이면 백엔드 세션 기반으로 소유자 확인 불가.
    // 타인이 체크아웃한 경우 백엔드는 반드시 checkedOutBy를 채워 반환해야 하므로,
    // null인 경우 현재 사용자 본인의 체크아웃으로 간주합니다.
    if (!checkoutStatus.checkedOutBy) {
      return true
    }

    if (!currentUserId) {
      return false
    }

    return checkoutStatus.checkedOutBy === currentUserId
  }, [checkoutStatus.checkedOutBy, checkoutStatus.isCheckedOut, currentUserId])

  // 전체 eqpItems 기준으로 그룹화 (Gateway/gateway_group 선택 시 설비 목록 조회용)
  // gateway 그룹은 Redis shard lease 점유 현황 기준으로 분류한다.
  const { gatewayGroups, businessGroups } = useMemo(
    () => groupEqpItems(eqpItems, gatewayShardLeasesQuery.data),
    [eqpItems, gatewayShardLeasesQuery.data],
  )

  // Gateway 선택 시 표시할 전체 게이트웨이 설비 목록입니다.
  const gatewayAllItems = useMemo(
    () => gatewayGroups.flatMap((group) => group.items),
    [gatewayGroups],
  )

  // gateway_group 선택 시 해당 그룹 파생 (설비 목록 + 미점유 뱃지 표시용)
  const selectedGatewayGroup = useMemo(() => {
    if (selection.type !== 'gateway_group') {
      return null
    }
    return gatewayGroups.find((g) => g.appIndex === selection.groupIndex) ?? null
  }, [selection, gatewayGroups])

  const gatewayGroupItems = useMemo(
    () => selectedGatewayGroup?.items ?? [],
    [selectedGatewayGroup],
  )

  const businessGroupItems = useMemo(() => {
    if (selection.type !== 'business_group') {
      return []
    }
    const group = businessGroups.find((g) => g.appIndex === selection.groupIndex)
    return group?.items ?? []
  }, [businessGroups, selection])

  const businessAllItems = useMemo(
    () => businessGroups.flatMap((group) => group.items),
    [businessGroups],
  )

  const businessGroupModels = useMemo(() => {
    if (selection.type !== 'business_group' && selection.type !== 'business_all') {
      return []
    }

    const modelItems = modelListQuery.data?.items ?? []
    const modelVersionKeySet = new Set(
      (selection.type === 'business_all' ? businessAllItems : businessGroupItems)
        .map((eqp) => eqp.modelVersionKey)
        .filter((modelVersionKey) => typeof modelVersionKey === 'number' && modelVersionKey > 0),
    )

    const uniqueModels = new Map<number, ModelInfo>()
    modelItems.forEach((model) => {
      if (modelVersionKeySet.has(model.modelVersionKey)) {
        uniqueModels.set(model.modelVersionKey, model)
      }
    })

    return Array.from(uniqueModels.values())
  }, [businessAllItems, businessGroupItems, modelListQuery.data?.items, selection])

  const managementTargetEqpId =
    managementDialog.type === 'info' ||
    managementDialog.type === 'model' ||
    managementDialog.type === 'delete'
      ? managementDialog.eqpId
      : null

  const needsManageDetail =
    managementDialog.type === 'info' ||
    managementDialog.type === 'model'
  const needsManageOptions =
    managementDialog.type === 'create' ||
    managementDialog.type === 'info' ||
    managementDialog.type === 'model'

  const eqpManageDetailQuery = useEqpManageDetail(managementTargetEqpId, needsManageDetail)
  const eqpManageOptionsQuery = useEqpManageOptions(needsManageOptions)

  const appliedParamSummary = useMemo(() => {
    if (!selectedEqpId) {
      return { version: '—', description: '—' }
    }

    if (selectedEqpManageDetailQuery.isLoading && !selectedEqpManageDetailQuery.data) {
      return { version: t('eqp.version.loading'), description: t('eqp.version.loading') }
    }

    if (selectedEqpManageDetailQuery.error) {
      return { version: t('eqp.version.unavailable'), description: t('eqp.version.unavailable') }
    }

    const appliedVersion = selectedEqpManageDetailQuery.data?.appliedParamVersion?.trim()
    const appliedDescription = selectedEqpManageDetailQuery.data?.appliedParamDescription?.trim()

    return {
      version: appliedVersion && appliedVersion.length > 0 ? appliedVersion : t('eqp.version.notApplied'),
      description:
        appliedDescription && appliedDescription.length > 0
          ? appliedDescription
          : t('eqp.version.noDesc'),
    }
  }, [
    selectedEqpId,
    selectedEqpManageDetailQuery.data,
    selectedEqpManageDetailQuery.error,
    selectedEqpManageDetailQuery.isLoading,
    t,
  ])

  // Gateway/gateway_group 선택 시 표시할 이름입니다.
  const selectedGroupName = useMemo(() => {
    if (selection.type === 'gateway_all') {
      return 'Gateway'
    }

    if (selection.type === 'business_all') {
      return 'Business'
    }

    if (selection.type === 'business_group') {
      return `business_app${selection.groupIndex}`
    }

    if (selection.type !== 'gateway_group') {
      return ''
    }
    return `gateway_app${selection.groupIndex}`
  }, [selection])

  // 선택이 바뀌면 선택 종속(transient) 로컬 상태를 정리한다 — effect 대신 render 중
  // prev 비교로 조정 (react.dev "adjusting state when a prop changes").
  // store 액션(clearSelection/setEditMode)은 resetSelectionTransientStates 에 남기고,
  // React 로컬 상태는 selection 변화를 감지해 같은 render pass 에서 초기화한다.
  const [prevSelectionForTransients, setPrevSelectionForTransients] = useState(selection)
  if (prevSelectionForTransients !== selection) {
    setPrevSelectionForTransients(selection)
    setAppliedVersion(EMPTY_VERSION_VALUE)
    setLocalEditRows([])
    setIsCheckInModalOpen(false)
    setCheckInErrorMessage(null)
  }

  const resetSelectionTransientStates = useCallback(() => {
    clearSelection()
    setEditMode(false)
  }, [clearSelection, setEditMode])

  const closeManagementDialog = useCallback(() => {
    setManagementDialog(EMPTY_MANAGEMENT_DIALOG_STATE)
    setManagementErrorMessage(null)
  }, [])

  const openEqpCreateDialog = useCallback((interfaceType: ProtocolType) => {
    setManagementErrorMessage(null)
    setManagementDialog({ type: 'create', interfaceType })
  }, [])

  const openEqpInfoDialog = useCallback((eqpId: string) => {
    setManagementErrorMessage(null)
    setManagementDialog({ type: 'info', eqpId })
  }, [])

  const openEqpModelDialog = useCallback((eqpId: string) => {
    setManagementErrorMessage(null)
    setManagementDialog({ type: 'model', eqpId })
  }, [])

  const openEqpDeleteDialog = useCallback((eqpId: string) => {
    setManagementErrorMessage(null)
    setDeleteResultDialog(EMPTY_EQP_DELETE_RESULT_DIALOG_STATE)
    setManagementDialog({ type: 'delete', eqpId })
  }, [])

  const openLifecycleDialog = useCallback((eqp: EqpInfo, action: EqpLifecycleAction) => {
    setLifecycleErrorMessage(null)
    setLifecycleResultDialog(EMPTY_EQP_LIFECYCLE_RESULT_DIALOG_STATE)
    if (!isActiveEquipment(eqp)) {
      setLifecycleResultDialog({
        open: true,
        status: 'failure',
        action,
        eqpId: eqp.eqpId,
        message: t(PASSIVE_LIFECYCLE_UNSUPPORTED_KEY),
      })
      return
    }
    setLifecycleDialog({
      open: true,
      action,
      eqp,
    })
  }, [t])

  const closeLifecycleDialog = useCallback(() => {
    setLifecycleDialog(EMPTY_EQP_LIFECYCLE_DIALOG_STATE)
    setLifecycleErrorMessage(null)
  }, [])

  /**
   * 라우트 스코프와 store 의 selection 을 맞춥니다(URL → store 단방향 보정).
   *
   * selection 은 sessionStorage 에 남으므로 `/eqp/business` 로 들어와도 이전 gateway 선택이
   * 복원될 수 있다. 그러면 URL 은 business 인데 화면은 gateway 를 그린다 — URL 이 원천이므로
   * 어긋난 쪽(store)을 그 스코프의 "전체" 선택으로 되돌린다.
   *
   * 역방향(store → URL)은 만들지 않는다. 스코프를 바꾸는 수단이 LNB navigate 뿐이라
   * 역방향 동기화는 같은 상태를 두 곳에서 쓰게 만들 뿐이다.
   *
   * selection 을 렌더 클로저가 아니라 `getState()` 로 읽어 **스코프가 바뀔 때만** 돈다. selection
   * 을 의존성에 넣으면, 아래 정합성 effect 가 빈 그룹을 감지해 선택을 풀 때마다 이 effect 가
   * 다시 선택해 두 effect 가 서로를 되돌리는 무한 루프가 된다.
   */
  useEffect(() => {
    const { type } = useEqpUiStore.getState().selection
    const isBusinessSelection = type === 'business_all' || type === 'business_group'
    const isGatewaySelection =
      type === 'gateway_all' || type === 'gateway_group' || type === 'eqp'

    if (scope === 'business' && !isBusinessSelection) {
      selectBusinessAll()
      return
    }
    if (scope === 'gateway' && !isGatewaySelection) {
      selectGatewayAll()
    }
  }, [scope, selectBusinessAll, selectGatewayAll])

  /**
   * sessionStorage에서 복원된 선택 상태가 현재 목록과 불일치하면 선택을 정리합니다.
   * 목록 조회 성공 이후에만 검증해 로딩 중 오탐으로 선택이 해제되는 문제를 방지합니다.
   */
  useEffect(() => {
    // 라인 스코프 미확정(라인 목록 로딩/선택 시드 전)이면 eqpItems 가 빈 목록이므로,
    // 오탐으로 선택이 풀리지 않게 lineKey 해석 이후에만 검증한다.
    if (!eqpListQuery.isSuccess || selectedLineKey === null) {
      return
    }

    if (selection.type === 'eqp') {
      const existsSelectedEqp = eqpItems.some((item) => item.eqpId === selection.eqpId)
      if (!existsSelectedEqp) {
        resetSelectionTransientStates()
      }
      return
    }

    if (selection.type === 'gateway_group') {
      // gateway 그룹은 shard lease 조회가 끝나야 확정되므로, 조회 전 오탐으로 선택이 풀리지 않게 한다.
      if (!gatewayShardLeasesQuery.isSuccess) {
        return
      }
      const existsSelectedGroup = gatewayGroups.some((group) => group.appIndex === selection.groupIndex)
      if (!existsSelectedGroup) {
        resetSelectionTransientStates()
      }
      return
    }

    if (selection.type === 'business_group') {
      const existsSelectedGroup = businessGroups.some((group) => group.appIndex === selection.groupIndex)
      if (!existsSelectedGroup) {
        resetSelectionTransientStates()
      }
      return
    }

    if (selection.type === 'business_all' && businessGroups.length === 0) {
      resetSelectionTransientStates()
      return
    }

    if (
      selection.type === 'gateway_all' &&
      gatewayShardLeasesQuery.isSuccess &&
      gatewayGroups.length === 0
    ) {
      resetSelectionTransientStates()
    }
  }, [
    eqpListQuery.isSuccess,
    gatewayShardLeasesQuery.isSuccess,
    selectedLineKey,
    selection,
    eqpItems,
    gatewayGroups,
    businessGroups,
    resetSelectionTransientStates,
  ])

  // 관리 다이얼로그 대상 EQP가 목록에서 사라지면 닫는다 — 조건부 render-phase 조정.
  // 닫히면 managementTargetEqpId 가 null 이 되어 조건이 풀리므로 수렴이 보장된다.
  if (
    eqpListQuery.isSuccess &&
    selectedLineKey !== null &&
    managementTargetEqpId !== null &&
    !eqpItems.some((item) => item.eqpId === managementTargetEqpId)
  ) {
    setManagementDialog(EMPTY_MANAGEMENT_DIALOG_STATE)
    setManagementErrorMessage(null)
  }

  // 편집 모드 진입 또는 EDIT 파라미터 갱신 시 로컬 편집 행을 동기화한다 —
  // effect 대신 render 중 prev 비교로 조정 (react.dev "adjusting state when a prop changes").
  const [prevEditSync, setPrevEditSync] = useState<{
    isEditMode: boolean
    data: typeof editParamsQuery.data
  }>({ isEditMode: false, data: undefined })
  if (prevEditSync.isEditMode !== isEditMode || prevEditSync.data !== editParamsQuery.data) {
    setPrevEditSync({ isEditMode, data: editParamsQuery.data })
    if (isEditMode) {
      setLocalEditRows(
        (editParamsQuery.data ?? []).map((p) =>
          toEditableParamRow({
            paramName: p.paramName,
            paramValue: p.paramValue ?? '',
            description: p.description ?? '',
          }),
        ),
      )
    }
  }

  // 선택 EQP 변경 또는 버전 목록 갱신 시 버전 기본 선택값을 조정한다 — render 중 prev 비교.
  // selectedEqpId가 없으면 (none/gateway_group 상태) 빈 문자열로 초기화한다.
  const [prevVersionDeps, setPrevVersionDeps] = useState<{
    selectedEqpId: string | null
    versionOptions: readonly string[]
  }>({ selectedEqpId: null, versionOptions: [] })
  if (
    prevVersionDeps.selectedEqpId !== selectedEqpId ||
    prevVersionDeps.versionOptions !== versionOptions
  ) {
    setPrevVersionDeps({ selectedEqpId, versionOptions })
    if (!selectedEqpId || versionOptions.length === 0) {
      setAppliedVersion(EMPTY_VERSION_VALUE)
    } else {
      setAppliedVersion((previous) =>
        previous && versionOptions.includes(previous) ? previous : versionOptions[0],
      )
    }
  }

  /**
   * 체크아웃 상태를 감지해 자동으로 편집 모드를 복원합니다.
   * 새로고침 후에도 내가 체크아웃한 상태라면 편집 모드가 유지됩니다.
   * selectedEqpId가 없으면 (none/gateway_group 상태) 실행하지 않습니다.
   *
   * NOTE: 현재 사용자 ID는 백엔드 세션에서 확인하므로 프론트에서 직접 비교할 수 없습니다.
   * 체크아웃 상태가 있으면 편집 모드로 복원합니다.
   */
  useEffect(() => {
    if (!selectedEqpId) {
      return
    }
    if (isCheckedOutByCurrentUser && !isEditMode) {
      setEditMode(true)
    }
  }, [selectedEqpId, isCheckedOutByCurrentUser, isEditMode, setEditMode])

  /**
   * 개별 설비 선택 처리.
   * 선택 시 관련 캐시를 즉시 무효화해 최신 데이터를 반영합니다.
   */
  const handleSelectEqp = useCallback((eqpId: string) => {
    // 선택한 EQP의 관련 캐시 즉시 무효화 → 백그라운드 리페치 트리거
    void invalidateEqpSelectionQueries(queryClient, eqpId)

    selectEqp(eqpId)
    setAppliedVersion(EMPTY_VERSION_VALUE)
    setEditMode(false)
    setLocalEditRows([])
    setIsCheckInModalOpen(false)
    setCheckInErrorMessage(null)
  }, [queryClient, selectEqp, setEditMode])

  /**
   * gateway_app 그룹 선택 처리.
   * 선택 시 eqpList 캐시를 무효화해 최신 설비 목록을 반영합니다.
   */
  const handleSelectGatewayGroup = useCallback((groupIndex: number) => {
    // 그룹 선택 시 eqpList/shard lease 캐시 무효화 → 최신 설비 목록·점유 현황 반영
    void queryClient.invalidateQueries({ queryKey: eqpQueryKeys.list() })
    void queryClient.invalidateQueries({ queryKey: eqpQueryKeys.gatewayShardLeases() })
    selectGatewayGroup(groupIndex)
  }, [queryClient, selectGatewayGroup])

  /**
   * business_app 그룹 선택 처리.
   * 선택 시 eqp/model 목록 캐시를 무효화해 최신 데이터를 반영합니다.
   */
  const handleSelectBusinessGroup = useCallback((groupIndex: number) => {
    void queryClient.invalidateQueries({ queryKey: eqpQueryKeys.list() })
    void queryClient.invalidateQueries({ queryKey: modelQueryKeys.list() })
    selectBusinessGroup(groupIndex)
  }, [queryClient, selectBusinessGroup])

  /**
   * Business 전체 선택 처리.
   * 선택 시 eqp/model 목록 캐시를 무효화해 최신 데이터를 반영합니다.
   */
  const handleSelectBusinessAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: eqpQueryKeys.list() })
    void queryClient.invalidateQueries({ queryKey: modelQueryKeys.list() })
    // 스코프 전환은 URL 이 원천이다 — navigate 하면 위 보정 effect 가 selection 을 맞춘다.
    navigate('/eqp/business')
  }, [navigate, queryClient])

  /**
   * Gateway 전체 선택 처리.
   * 선택 시 eqpList 캐시를 무효화해 최신 설비 목록을 반영합니다.
   */
  const handleSelectGatewayAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: eqpQueryKeys.list() })
    void queryClient.invalidateQueries({ queryKey: eqpQueryKeys.gatewayShardLeases() })
    // 스코프 전환은 URL 이 원천이다 — navigate 하면 위 보정 effect 가 selection 을 맞춘다.
    navigate('/eqp/gateway')
  }, [navigate, queryClient])

  const handleSaveCreateEqp = async (request: EqpCreateRequest) => {
    try {
      setManagementErrorMessage(null)
      await createEqpMutation.mutateAsync(request)
      closeManagementDialog()
      handleSelectEqp(request.eqpId)
    } catch (error) {
      setManagementErrorMessage(resolveErrorMessage(error, t('error.eqp.create')))
    }
  }

  const handleSaveEqpUpdate = async (request: EqpUpdateRequest) => {
    if (!managementTargetEqpId) {
      setManagementErrorMessage(t('eqp.page.noSelectedForSave'))
      return
    }

    try {
      setManagementErrorMessage(null)
      await updateEqpMutation.mutateAsync({
        eqpId: managementTargetEqpId,
        request,
      })
      closeManagementDialog()
    } catch (error) {
      setManagementErrorMessage(resolveErrorMessage(error, t('error.eqp.update')))
    }
  }

  const handleDeleteEqp = async () => {
    if (managementDialog.type !== 'delete') {
      return
    }

    const targetEqpId = managementDialog.eqpId

    try {
      setManagementErrorMessage(null)
      await deleteEqpMutation.mutateAsync({ eqpId: targetEqpId })

      if (selectedEqpId === targetEqpId) {
        resetSelectionTransientStates()
      }

      closeManagementDialog()
      setDeleteResultDialog({
        open: true,
        status: 'success',
        eqpId: targetEqpId,
        message: t('eqp.page.deleteSuccess', { eqpId: targetEqpId }),
      })
    } catch (error) {
      closeManagementDialog()
      setDeleteResultDialog({
        open: true,
        status: 'failure',
        eqpId: targetEqpId,
        message: resolveErrorMessage(error, t('error.eqp.delete')),
      })
    }
  }

  const waitForEqpAsyncCompletion = useCallback(
    async (traceId: string, fallbackMessage: string) => {
      for (let attempt = 0; attempt < EQP_ASYNC_MAX_ATTEMPTS; attempt += 1) {
        const result = await eqpApi.getAsyncResult(traceId)

        if (result.status === 'PASS') {
          return
        }

        if (result.status === 'FAIL' || result.status === 'TIMEOUT') {
          throw new Error(result.errorMsg ?? fallbackMessage)
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, EQP_ASYNC_POLL_INTERVAL_MS)
        })
      }

      throw new Error(fallbackMessage)
    },
    [],
  )

  const executeLifecycleAction = useCallback(
    async (eqp: EqpInfo, action: EqpLifecycleAction) => {
      if (!isActiveEquipment(eqp)) {
        throw new Error(t(PASSIVE_LIFECYCLE_UNSUPPORTED_KEY))
      }

      const request = {
        interfaceType: eqp.commInterface,
        uiMessage: null,
      } as const

      if (action === 'start') {
        const traceId = await startEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
        await waitForEqpAsyncCompletion(traceId, t('eqp.page.startTimeout'))
        return
      }

      if (action === 'end') {
        const traceId = await endEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
        await waitForEqpAsyncCompletion(traceId, t('eqp.page.endTimeout'))
        return
      }

      if (action === 'reconnect') {
        // stuck(desired=STARTED + control=OFFLINE) 복구 — END+START 가 아니라 EQP_RECONNECT 단일 명령.
        const traceId = await reconnectEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
        await waitForEqpAsyncCompletion(traceId, t('eqp.page.startTimeout'))
        return
      }

      const endTraceId = await endEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
      await waitForEqpAsyncCompletion(endTraceId, t('eqp.page.endTimeout'))

      const startTraceId = await startEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
      await waitForEqpAsyncCompletion(startTraceId, t('eqp.page.startTimeout'))
    },
    [endEqpMutation, startEqpMutation, reconnectEqpMutation, waitForEqpAsyncCompletion, t],
  )

  const handleConfirmLifecycleAction = useCallback(async () => {
    const targetEqp = lifecycleDialog.eqp
    const action = lifecycleDialog.action

    if (!targetEqp) {
      setLifecycleErrorMessage(t('eqp.page.noSelectedForAction'))
      return
    }

    await lifecycleGuard.run(async () => {
      try {
        setLifecycleErrorMessage(null)
        await executeLifecycleAction(targetEqp, action)
        closeLifecycleDialog()
        setLifecycleResultDialog({
          open: true,
          status: 'success',
          action,
          eqpId: targetEqp.eqpId,
          message: null,
        })
      } catch (error) {
        const resolvedMessage =
          error instanceof Error && error.message
            ? error.message
            : resolveErrorMessage(error, t('eqp.page.lifecycleFailed'))

        closeLifecycleDialog()
        setLifecycleResultDialog({
          open: true,
          status: 'failure',
          action,
          eqpId: targetEqp.eqpId,
          message: resolvedMessage,
        })
      }
    })
  }, [closeLifecycleDialog, executeLifecycleAction, lifecycleDialog, lifecycleGuard, t])

  // 두 flag 는 mutateAsync(202) settle 뒤 최장 60초 폴링 구간까지 덮어야 한다 — guard 없이
  // mutation.isPending 만 보면 그 구간에 버튼이 되살아나 명령이 중복 발행된다(S09 D-1 / D-2).
  const isLifecyclePending =
    lifecycleGuard.isRunning ||
    startEqpMutation.isPending ||
    endEqpMutation.isPending ||
    reconnectEqpMutation.isPending

  const isPollingGroupPending =
    pollingGroupGuard.isRunning ||
    startPollingGroupMutation.isPending ||
    endPollingGroupMutation.isPending

  const handleStartPollingGroup = useCallback(
    async (eqpId: string, groupMessageName: string): Promise<boolean> => {
      const result = await pollingGroupGuard.run(async () => {
        const traceId = await startPollingGroupMutation.mutateAsync({ eqpId, groupMessageName })
        await waitForEqpAsyncCompletion(traceId, t('eqp.page.pollingGroupStartTimeout'))
      })
      return result.dispatched
    },
    [pollingGroupGuard, startPollingGroupMutation, waitForEqpAsyncCompletion, t],
  )

  const handleEndPollingGroup = useCallback(
    async (eqpId: string, groupMessageName: string): Promise<boolean> => {
      const result = await pollingGroupGuard.run(async () => {
        const traceId = await endPollingGroupMutation.mutateAsync({ eqpId, groupMessageName })
        await waitForEqpAsyncCompletion(traceId, t('eqp.page.pollingGroupEndTimeout'))
      })
      return result.dispatched
    },
    [pollingGroupGuard, endPollingGroupMutation, waitForEqpAsyncCompletion, t],
  )

  /**
   * ResizableDivider 드래그 처리.
   * deltaY(px)를 컨테이너 높이 기준 비율로 변환해 상단 패널 높이를 조절합니다.
   * 최소 15% ~ 최대 85% 범위로 제한합니다.
   */
  const handleDividerDrag = useCallback((deltaY: number) => {
    setTopPanelHeightPercent((previous) => {
      const containerHeight = centerContainerRef.current?.clientHeight ?? 0
      if (containerHeight === 0) {
        return previous
      }
      const deltaPct = (deltaY / containerHeight) * 100
      return Math.min(PANEL_MAX_PERCENT, Math.max(PANEL_MIN_PERCENT, previous + deltaPct))
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

  /**
   * Check Out 버튼 클릭: DB에 EDIT 버전 파라미터 생성 후 편집 모드로 전환합니다.
   * appliedVersion이 없으면 빈 EDIT 버전으로 체크아웃합니다 (백엔드 허용).
   */
  const handleCheckOut = async () => {
    if (!selectedEqpId || isCheckoutSubmittingRef.current) {
      return
    }

    isCheckoutSubmittingRef.current = true
    setIsCheckoutSubmitting(true)

    try {
      setCheckInErrorMessage(null)
      await checkoutMutation.mutateAsync({
        eqpId: selectedEqpId,
        // appliedVersion이 없으면 빈 문자열로 전달 → 백엔드에서 빈 EDIT 버전 생성
        request: { sourceVersion: appliedVersion },
      })
      setEditMode(true)
    } catch (error) {
      // 409 (이미 체크아웃 중) 포함한 오류를 사용자에게 표시
      setCheckInErrorMessage(resolveErrorMessage(error, t('eqp.page.checkoutError')))
    } finally {
      isCheckoutSubmittingRef.current = false
      setIsCheckoutSubmitting(false)
    }
  }

  /**
   * Check In 버튼 클릭: 체크인 모달을 엽니다.
   */
  const handleRequestCheckIn = () => {
    if (!isEditMode) {
      return
    }
    setCheckInErrorMessage(null)
    setIsCheckInModalOpen(true)
  }

  /**
   * 편집 행의 특정 필드를 갱신합니다.
   */
  const updateLocalEditRow = useCallback((
    rowId: string,
    field: 'paramName' | 'paramValue' | 'description',
    nextValue: string,
  ) => {
    setLocalEditRows((prevRows) =>
      prevRows.map((row) => (row.rowId === rowId ? { ...row, [field]: nextValue } : row)),
    )
    setCheckInErrorMessage(null)
  }, [])

  const handleParamNameChange = useCallback((rowId: string, nextValue: string) => {
    updateLocalEditRow(rowId, 'paramName', nextValue)
  }, [updateLocalEditRow])

  const handleParamValueChange = useCallback((rowId: string, nextValue: string) => {
    updateLocalEditRow(rowId, 'paramValue', nextValue)
  }, [updateLocalEditRow])

  const handleParamDescriptionChange = useCallback((rowId: string, nextValue: string) => {
    updateLocalEditRow(rowId, 'description', nextValue)
  }, [updateLocalEditRow])

  /**
   * 편집용 빈 파라미터 행을 추가합니다.
   */
  const handleAddParamRow = useCallback(() => {
    setLocalEditRows((prevRows) => [
      ...prevRows,
      {
        rowId: createEditableParamRowId(),
        paramName: '',
        paramValue: '',
        description: '',
      },
    ])
    setCheckInErrorMessage(null)
  }, [])

  /**
   * 편집 중인 파라미터 행을 제거합니다.
   */
  const handleDeleteParamRow = useCallback((rowId: string) => {
    setLocalEditRows((prevRows) => prevRows.filter((row) => row.rowId !== rowId))
    setCheckInErrorMessage(null)
  }, [])

  const duplicatedParamNames = useMemo(() => {
    const duplicatedNames = new Set<string>()
    const seenNames = new Set<string>()

    localEditRows.forEach((row) => {
      const normalizedParamName = row.paramName.trim()
      if (!normalizedParamName) {
        return
      }

      if (seenNames.has(normalizedParamName)) {
        duplicatedNames.add(normalizedParamName)
        return
      }

      seenNames.add(normalizedParamName)
    })

    return Array.from(duplicatedNames)
  }, [localEditRows])

  const hasBlankParamName = useMemo(
    () => localEditRows.some((row) => row.paramName.trim().length === 0),
    [localEditRows],
  )
  const isEditParamRowsLoading = isEditMode && editParamsQuery.isLoading

  const paramEditValidationMessage = useMemo(() => {
    if (!isEditMode) {
      return null
    }

    if (isEditParamRowsLoading) {
      return null
    }

    if (localEditRows.length === 0) {
      return t('eqp.param.emptyValidation')
    }

    if (hasBlankParamName) {
      return t('eqp.param.blankName')
    }

    if (duplicatedParamNames.length > 0) {
      return t('eqp.param.duplicateName', { name: duplicatedParamNames[0] })
    }

    return null
  }, [duplicatedParamNames, hasBlankParamName, isEditMode, isEditParamRowsLoading, localEditRows.length, t])

  /**
   * Save 버튼 클릭: 로컬 편집 행을 DB EDIT 버전으로 저장합니다.
   */
  const handleSaveEditParams = async () => {
    if (!selectedEqpId) {
      return
    }

    if (localEditRows.length === 0) {
      setCheckInErrorMessage(t('eqp.param.emptySave'))
      return
    }

    if (hasBlankParamName) {
      setCheckInErrorMessage(t('eqp.param.blankName'))
      return
    }

    if (duplicatedParamNames.length > 0) {
      setCheckInErrorMessage(t('eqp.param.duplicateName', { name: duplicatedParamNames[0] }))
      return
    }

    try {
      setCheckInErrorMessage(null)
      await saveEditParamsMutation.mutateAsync({
        eqpId: selectedEqpId,
        params: localEditRows.map((row) => ({
          paramName: row.paramName.trim(),
          paramValue: row.paramValue,
          description: row.description,
        })),
      })
    } catch (error) {
      setCheckInErrorMessage(resolveErrorMessage(error, t('error.eqp.saveEditParams')))
    }
  }

  /**
   * Undo 버튼 클릭: 체크아웃 자체를 취소하고 EDIT 버전 파라미터를 모두 삭제합니다.
   */
  const handleUndoCheckout = async () => {
    if (!selectedEqpId || !isEditMode) {
      return
    }

    try {
      setCheckInErrorMessage(null)
      await undoCheckoutMutation.mutateAsync({ eqpId: selectedEqpId })
      setLocalEditRows([])
      setEditMode(false)
      setIsCheckInModalOpen(false)
    } catch (error) {
      setCheckInErrorMessage(resolveErrorMessage(error, t('error.eqp.undoCheckout')))
    }
  }

  /**
   * CheckInModal의 Save 클릭: 서버가 자동 생성한 버전으로 체크인합니다.
   */
  const handleCheckInSave = async (description: string) => {
    if (!selectedEqpId) {
      setCheckInErrorMessage(t('eqp.page.noSelectedForSave'))
      return
    }

    try {
      setCheckInErrorMessage(null)
      await checkinMutation.mutateAsync({
        eqpId: selectedEqpId,
        request: { description },
      })

      setLocalEditRows([])
      setEditMode(false)
      setIsCheckInModalOpen(false)
    } catch (error) {
      setCheckInErrorMessage(resolveErrorMessage(error, t('eqp.page.checkinError')))
    }
  }

  // 현재 파라미터 테이블에 표시할 행
  const checkInBaseParamRows = useMemo(
    () =>
      (checkInBaseParamsQuery.data ?? []).map((param) => ({
        paramName: param.paramName,
        paramValue: param.paramValue ?? '',
        description: param.description ?? '',
      })),
    [checkInBaseParamsQuery.data],
  )

  const checkInDiffRows = useMemo(
    () => computeEqpParamDiffRows(localEditRows, checkInBaseParamRows),
    [checkInBaseParamRows, localEditRows],
  )

  const displayParamRows = useMemo(() => {
    if (isEditMode) {
      return localEditRows
    }

    // 읽기 모드: 선택된 버전 파라미터
    return (readParamsQuery.data ?? []).map((p) => ({
      paramName: p.paramName,
      paramValue: p.paramValue ?? '',
      description: p.description ?? '',
    }))
  }, [isEditMode, localEditRows, readParamsQuery.data])

  /**
   * Mode 영역에 표시할 텍스트를 결정합니다.
   * - 읽기 모드: 첫 번째 파라미터의 description
   * - 편집 모드(체크아웃 중): "{checkedOutBy}님이 편집 중"
   */
  const modeDescriptionText = useMemo(() => {
    if (isEditMode || checkoutStatus.isCheckedOut) {
      const checkedOutBy = checkoutStatus.checkedOutBy
      return checkedOutBy ? t('eqp.mode.editingBy', { user: checkedOutBy }) : t('eqp.mode.editing')
    }
    // 읽기 모드: 첫 번째 파라미터의 description 표시
    const firstParam = readParamsQuery.data?.[0]
    return firstParam?.description ?? ''
  }, [isEditMode, checkoutStatus, readParamsQuery.data, t])

  const listErrorMessage = eqpListQuery.error
    ? resolveErrorMessage(eqpListQuery.error, t('eqp.page.listLoadError'))
    : null
  const lineListErrorMessage = lineListQuery.error
    ? resolveErrorMessage(lineListQuery.error, t('eqp.page.listLoadError'))
    : null
  const shardLeaseErrorMessage = gatewayShardLeasesQuery.error
    ? resolveErrorMessage(gatewayShardLeasesQuery.error, t('error.eqp.shardLeases'))
    : null
  const versionErrorMessage = eqpParamVersionsQuery.error
    ? resolveErrorMessage(eqpParamVersionsQuery.error, t('eqp.page.versionLoadError'))
    : null
  const managementDetailErrorMessage = needsManageDetail && eqpManageDetailQuery.error
    ? resolveErrorMessage(eqpManageDetailQuery.error, t('eqp.page.manageDetailLoadError'))
    : null
  const managementOptionsErrorMessage = needsManageOptions && eqpManageOptionsQuery.error
    ? resolveErrorMessage(eqpManageOptionsQuery.error, t('eqp.page.manageOptionsLoadError'))
    : null
  const managementModalErrorMessage =
    managementErrorMessage ?? managementDetailErrorMessage ?? managementOptionsErrorMessage

  // Check Out 버튼 비활성화: 설비 정보 없거나 다른 사용자가 이미 체크아웃 중인 경우
  // appliedVersion 없어도 (버전 없는 신규 설비) 체크아웃 가능 → !appliedVersion 조건 제거
  const isCheckoutDisabled =
    !eqpDetailQuery.data ||
    checkoutMutation.isPending ||
    isCheckoutSubmitting ||
    (checkoutStatus.isCheckedOut && !isEditMode)
  const isSaveDisabled =
    isEditParamRowsLoading ||
    saveEditParamsMutation.isPending ||
    undoCheckoutMutation.isPending ||
    localEditRows.length === 0 ||
    hasBlankParamName ||
    duplicatedParamNames.length > 0

  // 사이드바에 전달할 선택된 그룹 인덱스
  const selectedGroupIndex = selection.type === 'gateway_group' ? selection.groupIndex : null
  const selectedBusinessGroupIndex = selection.type === 'business_group' ? selection.groupIndex : null
  const isGatewaySelected = selection.type === 'gateway_all'

  return (
    <AppShellPage
      onAfterLogout={() => {
        clearDeployUiSessionState()
        resetSelectionTransientStates()
        closeManagementDialog()
      }}
    >
      {/* main: flex-1로 남은 화면 전체 높이 차지, min-h-0으로 flex shrink 허용 */}
      <main className="flex flex-1 min-h-0">
        <EqpSidebar
          eqpItems={eqpItems}
          shardLeases={gatewayShardLeasesQuery.data}
          selectedEqpId={selectedEqpId}
          isGatewaySelected={isGatewaySelected}
          isBusinessSelected={selection.type === 'business_all'}
          selectedBusinessGroupIndex={selectedBusinessGroupIndex}
          selectedGroupIndex={selectedGroupIndex}
          sidebarOpen={sidebarOpen}
          sidebarWidth={sidebarWidth}
          isLoading={
            eqpListQuery.isLoading || gatewayShardLeasesQuery.isLoading || lineListQuery.isLoading
          }
          errorMessage={listErrorMessage ?? shardLeaseErrorMessage ?? lineListErrorMessage}
          onSelectEqp={handleSelectEqp}
          onSelectGatewayAll={handleSelectGatewayAll}
          onSelectBusinessAll={handleSelectBusinessAll}
          onSelectGatewayGroup={handleSelectGatewayGroup}
          onSelectBusinessGroup={handleSelectBusinessGroup}
          onOpenEqpInfoUpdate={openEqpInfoDialog}
          onOpenEqpModelBinding={openEqpModelDialog}
          onOpenEqpDelete={openEqpDeleteDialog}
          onOpenEqpCreate={openEqpCreateDialog}
          onToggleSidebar={toggleSidebar}
          onResizeSidebar={handleSidebarDrag}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            {/* 가운데 영역: selection 유형에 따라 콘텐츠 분기 */}
            {selection.type === 'none' ? (
              /* 초기 진입 / 선택 없음: 안내 문구만 표시 */
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                {t('eqp.placeholder.select')}
              </div>
            ) : selection.type === 'gateway_all' || selection.type === 'gateway_group' ? (
              /* Gateway 또는 gateway_app 그룹 선택: 설비 목록 테이블 (파라미터/Checkout 없음) */
              <section className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
                <GatewayGroupTable
                  key={`${selection.type}-${selectedGroupName}`}
                  eqpItems={selection.type === 'gateway_all' ? gatewayAllItems : gatewayGroupItems}
                  groupName={selectedGroupName}
                  isUnleased={selectedGatewayGroup?.isUnleased ?? false}
                  isLifecyclePending={isLifecyclePending}
                  onLifecycleAction={openLifecycleDialog}
                />
              </section>
            ) : selection.type === 'business_all' || selection.type === 'business_group' ? (
              /* Business 또는 business_app 그룹 선택: 해당 범위 설비가 참조하는 모델 목록 테이블 */
              <section className="flex flex-1 flex-col p-3 md:p-4">
                <BusinessGroupModelTable
                  key={`business-${selection.type}-${selectedGroupName}`}
                  groupName={selectedGroupName}
                  models={businessGroupModels}
                  isLoading={modelListQuery.isLoading}
                  isFetching={modelListQuery.isFetching}
                />
              </section>
            ) : (
              /* 개별 설비 선택: 설비 정보 테이블 + ResizableDivider + 파라미터/Checkout 섹션 */
              <div
                ref={centerContainerRef}
                className="flex flex-1 flex-col overflow-hidden"
              >
                {/* 상단 패널: 설비 정보 테이블 */}
                <div
                  style={{ height: `${topPanelHeightPercent}%` }}
                  className="overflow-auto p-3 pb-0 md:p-4 md:pb-0"
                >
                  <EqpInfoTable
                    key={selectedEqpId ?? 'eqp-info'}
                    eqp={eqpDetailQuery.data ?? null}
                    modelInfo={eqpModelInfoQuery.data ?? null}
                    runtimeState={eqpRuntimeStateQuery.data ?? null}
                    isLoading={eqpDetailQuery.isLoading}
                    isFetching={
                      eqpDetailQuery.isFetching || eqpRuntimeStateQuery.isFetching || eqpModelInfoQuery.isFetching
                    }
                    isLifecyclePending={isLifecyclePending}
                    onLifecycleAction={openLifecycleDialog}
                  />

                  {eqpDetailQuery.data?.commInterface?.toUpperCase() === 'PLC' ? (
                    <EqpPollingGroupControl
                      key={`${selectedEqpId ?? 'eqp'}-polling-group`}
                      eqpId={eqpDetailQuery.data.eqpId}
                      isPending={isPollingGroupPending}
                      onStartGroup={handleStartPollingGroup}
                      onEndGroup={handleEndPollingGroup}
                    />
                  ) : null}
                </div>

                {/* 드래그 핸들: 위아래 패널 크기 조절 (15% ~ 85%) */}
                <ResizableDivider onDrag={handleDividerDrag} />

                {/* 하단 패널: 버전 선택 + Check Out/In + 파라미터 테이블 */}
                <div
                  style={{ height: `${100 - topPanelHeightPercent}%` }}
                  className="min-h-0 p-3 pt-0 md:p-4 md:pt-0"
                >
                  <section className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex h-8.5 items-center gap-1.5">
                        <Select
                          value={
                            appliedVersion === EMPTY_VERSION_VALUE ? SELECT_EMPTY_VALUE : appliedVersion
                          }
                          onValueChange={(next) =>
                            setAppliedVersion(next === SELECT_EMPTY_VALUE ? EMPTY_VERSION_VALUE : next)
                          }
                          disabled={isEditMode || versionOptions.length === 0 || eqpParamVersionsQuery.isLoading}
                        >
                          <SelectTrigger className="h-8 min-w-58 rounded-lg border border-input bg-card px-2.5 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {versionOptions.length === 0 ? (
                              <SelectItem value={SELECT_EMPTY_VALUE}>{t('eqp.version.noOption')}</SelectItem>
                            ) : (
                              versionOptions.map((version) => (
                                <SelectItem key={version} value={version}>
                                  {version}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEditMode ? (
                          <>
                            {/* Undo 버튼: 현재 체크아웃과 EDIT 행 전체를 취소 */}
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
                              onClick={() => void handleUndoCheckout()}
                              disabled={undoCheckoutMutation.isPending || saveEditParamsMutation.isPending}
                            >
                              {undoCheckoutMutation.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <RotateCcw className="size-3.5" aria-hidden="true" />
                              )}
                              Undo
                            </Button>
                            {/* Save 버튼: 로컬 편집 내용을 DB EDIT 버전에 반영 */}
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
                              onClick={() => void handleSaveEditParams()}
                              disabled={isSaveDisabled}
                            >
                              {saveEditParamsMutation.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                              ) : null}
                              Save
                            </Button>
                            {/* Check In 버튼 */}
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
                              onClick={handleRequestCheckIn}
                              disabled={!eqpDetailQuery.data || checkinMutation.isPending}
                            >
                              Check In
                            </Button>
                          </>
                        ) : (
                          /* Check Out 버튼: appliedVersion 없어도 활성화 (빈 EDIT 버전 생성 허용) */
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-[10px] border-border bg-muted px-3 text-xs font-semibold text-foreground"
                            onClick={() => void handleCheckOut()}
                            disabled={isCheckoutDisabled}
                            title={
                              checkoutStatus.isCheckedOut && checkoutStatus.checkedOutBy
                                ? t('eqp.checkout.byTitle', { user: checkoutStatus.checkedOutBy })
                                : undefined
                            }
                          >
                            {checkoutMutation.isPending ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                            ) : null}
                            Check Out
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 rounded-xl border border-border bg-muted px-3 py-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('eqp.version.currentApplied')}
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-foreground">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="font-semibold text-muted-foreground">
                            {t('eqp.version.labelVersion')}
                          </span>
                          <span>{appliedParamSummary.version}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="font-semibold text-muted-foreground">
                            {t('eqp.version.labelDesc')}
                          </span>
                          <span>{appliedParamSummary.description}</span>
                        </div>
                      </div>
                    </div>

                    {/* Mode 텍스트 영역: 읽기 모드는 첫 파라미터 description, 편집 모드는 "누구님이 편집 중" */}
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      <span className={isEditMode ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                        {modeDescriptionText}
                      </span>
                    </div>

                    {checkInErrorMessage ? (
                      <p className="mt-2 text-xs text-danger">{checkInErrorMessage}</p>
                    ) : null}

                    {versionErrorMessage ? (
                      <p className="mt-2 text-xs text-danger">{versionErrorMessage}</p>
                    ) : null}

                    {!checkInErrorMessage && paramEditValidationMessage ? (
                      <p className="mt-2 text-xs text-danger">{paramEditValidationMessage}</p>
                    ) : null}

                    <div className="mt-3 min-h-0 flex-1 border-t border-border pt-3">
                      <EqpParamTable
                        key={`${selectedEqpId ?? 'eqp-param'}-${appliedVersion}-${isEditMode ? 'edit' : 'read'}`}
                        rows={displayParamRows}
                        isEditMode={isEditMode}
                        isLoading={isEditMode ? editParamsQuery.isLoading : readParamsQuery.isLoading}
                        onChangeParamName={handleParamNameChange}
                        onChangeValue={handleParamValueChange}
                        onChangeDescription={handleParamDescriptionChange}
                        onAddRow={handleAddParamRow}
                        onDeleteRow={handleDeleteParamRow}
                      />
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <CheckInModal
        open={isCheckInModalOpen}
        isPending={checkinMutation.isPending}
        isDiffLoading={checkInBaseParamsQuery.isLoading}
        diffRows={checkInDiffRows}
        errorMessage={checkInErrorMessage}
        onOpenChange={setIsCheckInModalOpen}
        onSave={(description) => void handleCheckInSave(description)}
        onCancel={() => setIsCheckInModalOpen(false)}
      />

      {(managementDialog.type === 'create' || managementDialog.type === 'info') && (
        <Suspense fallback={null}>
          <EqpManageFormModal
            open
            mode={managementDialog.type === 'create' ? 'create' : 'update'}
            interfaceType={
              managementDialog.type === 'create'
                ? managementDialog.interfaceType
                : eqpManageDetailQuery.data?.commInterface ?? 'SECS'
            }
            detail={managementDialog.type === 'info' ? eqpManageDetailQuery.data ?? null : null}
            options={eqpManageOptionsQuery.data ?? null}
            isLoading={managementDialog.type === 'info' ? eqpManageDetailQuery.isLoading : false}
            isOptionsLoading={eqpManageOptionsQuery.isLoading}
            isPending={createEqpMutation.isPending || updateEqpMutation.isPending}
            errorMessage={managementModalErrorMessage}
            onOpenChange={(open) => {
              if (!open) {
                closeManagementDialog()
              }
            }}
            onSubmit={(request) =>
              managementDialog.type === 'create'
                ? handleSaveCreateEqp(request as EqpCreateRequest)
                : handleSaveEqpUpdate(request as EqpUpdateRequest)
            }
          />
        </Suspense>
      )}

      <EqpModelBindingModal
        open={managementDialog.type === 'model'}
        detail={managementDialog.type === 'model' ? eqpManageDetailQuery.data ?? null : null}
        options={eqpManageOptionsQuery.data ?? null}
        isLoading={eqpManageDetailQuery.isLoading}
        isOptionsLoading={eqpManageOptionsQuery.isLoading}
        isPending={updateEqpMutation.isPending}
        errorMessage={managementModalErrorMessage}
        onOpenChange={(open) => {
          if (!open) {
            closeManagementDialog()
          }
        }}
        onSubmit={handleSaveEqpUpdate}
      />

      <EqpDeleteConfirmDialog
        open={managementDialog.type === 'delete'}
        eqpId={managementDialog.type === 'delete' ? managementDialog.eqpId : null}
        isPending={deleteEqpMutation.isPending}
        errorMessage={null}
        onOpenChange={(open) => {
          if (!open) {
            closeManagementDialog()
          }
        }}
        onConfirm={handleDeleteEqp}
      />

      <EqpDeleteResultDialog
        open={deleteResultDialog.open}
        status={deleteResultDialog.status}
        eqpId={deleteResultDialog.eqpId}
        message={deleteResultDialog.message}
        onOpenChange={(open) => {
          if (!open) {
            // Radix Dialog의 close 애니메이션 동안에도 직전 status/message를 유지해야 합니다.
            // 전체 상태를 EMPTY로 초기화하면 status 기본값(success)이 잠깐 노출되어 실패 → 정상 팝업이 깜빡이는 버그가 발생합니다.
            setDeleteResultDialog((prev) => ({ ...prev, open: false }))
          }
        }}
      />

      <EqpLifecycleActionDialog
        open={lifecycleDialog.open}
        action={lifecycleDialog.action}
        eqpId={lifecycleDialog.eqp?.eqpId ?? null}
        isPending={isLifecyclePending}
        errorMessage={lifecycleErrorMessage}
        onOpenChange={(open) => {
          if (!open) {
            closeLifecycleDialog()
          }
        }}
        onConfirm={handleConfirmLifecycleAction}
      />

      <EqpLifecycleResultDialog
        open={lifecycleResultDialog.open}
        status={lifecycleResultDialog.status}
        action={lifecycleResultDialog.action}
        eqpId={lifecycleResultDialog.eqpId}
        message={lifecycleResultDialog.message}
        onOpenChange={(open) => {
          if (!open) {
            setLifecycleResultDialog(EMPTY_EQP_LIFECYCLE_RESULT_DIALOG_STATE)
          }
        }}
      />

    </AppShellPage>
  )
}
