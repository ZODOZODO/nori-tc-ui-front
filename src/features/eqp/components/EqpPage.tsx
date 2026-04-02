import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleUserRound, Loader2, LogOut, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { clampSidebarWidth } from '@/shared/layout/sidebar-layout'
import { useSharedLayoutStore } from '@/shared/stores/shared-layout.store'
import { CheckInModal } from './CheckInModal'
import { EqpDeleteConfirmDialog } from './EqpDeleteConfirmDialog'
import { EqpDeleteResultDialog } from './EqpDeleteResultDialog'
import { EqpInfoTable } from './EqpInfoTable'
import { EqpManageFormModal } from './EqpManageFormModal'
import { EqpModelBindingModal } from './EqpModelBindingModal'
import { EqpParamTable } from './EqpParamTable'
import { EqpParamVersionModal } from './EqpParamVersionModal'
import { EqpSidebar } from './EqpSidebar'
import { GatewayGroupTable } from './GatewayGroupTable'
import { ResizableDivider } from '@/components/ui/resizable-divider'
import { authApi } from '@/features/auth/api/auth.api'
import { clearDeployUiSessionState } from '@/features/deploy/stores/deploy-ui.store'
import { useEqpDetail } from '../hooks/useEqpDetail'
import { useEqpList } from '../hooks/useEqpList'
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
  EqpApiError,
  type EqpCreateRequest,
  type EqpInfo,
  type EqpParamRow,
  type EqpUpdateRequest,
  type ProtocolType,
} from '../types/eqp.types'
import { groupEqpItems } from '../utils/eqp-group.util'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { useMe } from '@/features/profile/hooks/useProfile'

const LOGIN_ROUTE = '/login'
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const EMPTY_VERSION_VALUE = ''
const NO_VERSION_OPTION_LABEL = '버전 없음'

// ResizableDivider 크기 제한 (%)
const PANEL_MIN_PERCENT = 15
const PANEL_MAX_PERCENT = 85

type EditableEqpParamRow = EqpParamRow & { rowId: string }

type EqpManagementDialogState =
  | { type: 'none' }
  | { type: 'create'; interfaceType: ProtocolType }
  | { type: 'info'; eqpId: string }
  | { type: 'model'; eqpId: string }
  | { type: 'param'; eqpId: string }
  | { type: 'delete'; eqpId: string }

interface EqpDeleteResultDialogState {
  open: boolean
  status: 'success' | 'failure'
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
 * 상단 네비게이션 메뉴 구성입니다.
 */
const TOP_NAVIGATION_ITEMS = [
  { name: 'Eqp', subLabel: 'Eqp Info', route: '/eqp' },
  { name: 'Model', subLabel: 'Model Info', route: '/model' },
  { name: 'Deploy', subLabel: 'Eqp Deploy / Model Deploy', route: '/deploy' },
  { name: 'Dlq', subLabel: 'Gateway Dlq / Business Dlq', route: null },
  { name: 'User', subLabel: 'User Info / Group Info', route: null },
] as const

/**
 * 알 수 없는 오류를 화면 메시지로 변환합니다.
 */
const resolveErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof EqpApiError) {
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

/**
 * 브라우저에서 접근 가능한 CSRF 쿠키를 삭제합니다.
 */
const clearCsrfCookie = () => {
  if (typeof document === 'undefined') {
    return
  }
  document.cookie = `${CSRF_COOKIE_NAME}=; Max-Age=0; path=/`
}

/**
 * EQP Info 메인 페이지입니다.
 * DB 기반 Check Out / Save / Check In 흐름을 처리합니다.
 *
 * 체크아웃 잠금: tc_eqp_param.param_version='EDIT' 존재 여부 = 체크아웃 상태
 *
 * 선택 상태:
 * - none: 초기 진입 / 선택 없음 → 가운데 영역 비어있음
 * - gateway_group: gateway_app 그룹 클릭 → 해당 그룹 설비 목록 테이블 표시
 * - eqp: 개별 설비 클릭 → 설비 정보 + ResizableDivider + 파라미터/Checkout 영역 표시
 */
export function EqpPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const selection = useEqpUiStore((state) => state.selection)
  const isEditMode = useEqpUiStore((state) => state.isEditMode)
  const isProfileModalOpen = useEqpUiStore((state) => state.isProfileModalOpen)
  const selectEqp = useEqpUiStore((state) => state.selectEqp)
  const selectGatewayGroup = useEqpUiStore((state) => state.selectGatewayGroup)
  const clearSelection = useEqpUiStore((state) => state.clearSelection)
  const setEditMode = useEqpUiStore((state) => state.setEditMode)
  const setProfileModalOpen = useEqpUiStore((state) => state.setProfileModalOpen)
  const topPanelHeightPercent = useEqpUiStore((state) => state.topPanelHeightPercent)
  const setTopPanelHeightPercent = useEqpUiStore((state) => state.setTopPanelHeightPercent)

  // 사이드바 상태는 EQP/Model 페이지 간 공유 store에서 관리합니다.
  const sidebarOpen = useSharedLayoutStore((state) => state.sidebarOpen)
  const sidebarWidth = useSharedLayoutStore((state) => state.sidebarWidth)
  const toggleSidebar = useSharedLayoutStore((state) => state.toggleSidebar)
  const setSidebarWidth = useSharedLayoutStore((state) => state.setSidebarWidth)

  // selection에서 현재 선택된 eqpId 파생 (eqp 타입일 때만 유효)
  const selectedEqpId = selection.type === 'eqp' ? selection.eqpId : null
  const meQuery = useMe(Boolean(selectedEqpId))
  const currentUserId = meQuery.data?.userId ?? null

  const eqpListQuery = useEqpList()
  const eqpDetailQuery = useEqpDetail(selectedEqpId)
  const eqpParamVersionsQuery = useEqpParamVersions(selectedEqpId)
  const eqpRuntimeStateQuery = useEqpRuntimeState(selectedEqpId)
  const eqpModelInfoQuery = useEqpModelInfo(
    eqpDetailQuery.data && eqpDetailQuery.data.modelVersionKey > 0
      ? eqpDetailQuery.data.modelVersionKey
      : null,
  )

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

  // 편집 중 로컬 상태 (편집 내용을 임시 보관)
  const [localEditRows, setLocalEditRows] = useState<EditableEqpParamRow[]>([])
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false)
  const [checkInErrorMessage, setCheckInErrorMessage] = useState<string | null>(null)
  const [isLogoutPending, setIsLogoutPending] = useState(false)
  const [managementDialog, setManagementDialog] = useState<EqpManagementDialogState>(
    EMPTY_MANAGEMENT_DIALOG_STATE,
  )
  const [managementErrorMessage, setManagementErrorMessage] = useState<string | null>(null)
  const [deleteResultDialog, setDeleteResultDialog] = useState<EqpDeleteResultDialogState>(
    EMPTY_EQP_DELETE_RESULT_DIALOG_STATE,
  )

  // 가운데 컨테이너 높이 계산용 ref
  const centerContainerRef = useRef<HTMLDivElement>(null)
  // 체크아웃 중복 요청(더블 클릭) 방지용 로컬 가드
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState(false)
  const isCheckoutSubmittingRef = useRef(false)

  const { createEqpMutation, updateEqpMutation, deleteEqpMutation } = useEqpMutations()
  const { checkoutMutation, saveEditParamsMutation, undoCheckoutMutation, checkinMutation } =
    useEqpParamMutations()
  const eqpItems = useMemo(() => resolveEqpItems(eqpListQuery.data as unknown), [eqpListQuery.data])
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

  // 전체 eqpItems 기준으로 그룹화 (gateway_group 선택 시 설비 목록 조회용)
  const { gatewayGroups } = useMemo(() => groupEqpItems(eqpItems), [eqpItems])

  // gateway_group 선택 시 해당 그룹의 설비 목록 파생
  const gatewayGroupItems = useMemo(() => {
    if (selection.type !== 'gateway_group') {
      return []
    }
    const group = gatewayGroups.find((g) => g.appIndex === selection.groupIndex)
    return group?.items ?? []
  }, [selection, gatewayGroups])

  const managementTargetEqpId =
    managementDialog.type === 'info' ||
    managementDialog.type === 'model' ||
    managementDialog.type === 'param' ||
    managementDialog.type === 'delete'
      ? managementDialog.eqpId
      : null

  const needsManageDetail =
    managementDialog.type === 'info' ||
    managementDialog.type === 'model' ||
    managementDialog.type === 'param'
  const needsManageOptions =
    managementDialog.type === 'create' ||
    managementDialog.type === 'info' ||
    managementDialog.type === 'model'

  const eqpManageDetailQuery = useEqpManageDetail(managementTargetEqpId, needsManageDetail)
  const eqpManageOptionsQuery = useEqpManageOptions(needsManageOptions)

  // gateway_group 선택 시 그룹명 파생
  const selectedGroupName = useMemo(() => {
    if (selection.type !== 'gateway_group') {
      return ''
    }
    return `gateway_app${selection.groupIndex}`
  }, [selection])

  const resetSelectionTransientStates = useCallback(() => {
    clearSelection()
    setAppliedVersion(EMPTY_VERSION_VALUE)
    setEditMode(false)
    setLocalEditRows([])
    setIsCheckInModalOpen(false)
    setCheckInErrorMessage(null)
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

  const openEqpParamDialog = useCallback((eqpId: string) => {
    setManagementErrorMessage(null)
    setManagementDialog({ type: 'param', eqpId })
  }, [])

  const openEqpDeleteDialog = useCallback((eqpId: string) => {
    setManagementErrorMessage(null)
    setDeleteResultDialog(EMPTY_EQP_DELETE_RESULT_DIALOG_STATE)
    setManagementDialog({ type: 'delete', eqpId })
  }, [])

  /**
   * sessionStorage에서 복원된 선택 상태가 현재 목록과 불일치하면 선택을 정리합니다.
   * 목록 조회 성공 이후에만 검증해 로딩 중 오탐으로 선택이 해제되는 문제를 방지합니다.
   */
  useEffect(() => {
    if (!eqpListQuery.isSuccess) {
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
      const existsSelectedGroup = gatewayGroups.some((group) => group.appIndex === selection.groupIndex)
      if (!existsSelectedGroup) {
        resetSelectionTransientStates()
      }
    }
  }, [eqpListQuery.isSuccess, selection, eqpItems, gatewayGroups, resetSelectionTransientStates])

  useEffect(() => {
    if (!eqpListQuery.isSuccess || !managementTargetEqpId) {
      return
    }

    const existsTargetEqp = eqpItems.some((item) => item.eqpId === managementTargetEqpId)
    if (!existsTargetEqp) {
      closeManagementDialog()
    }
  }, [
    closeManagementDialog,
    eqpItems,
    eqpListQuery.isSuccess,
    managementTargetEqpId,
  ])

  /**
   * 편집 모드가 활성화되면 EDIT 파라미터를 로컬 편집 행으로 동기화합니다.
   * EDIT 파라미터 데이터가 갱신될 때마다 실행됩니다.
   */
  useEffect(() => {
    if (!isEditMode) {
      return
    }
    const editData = editParamsQuery.data
    setLocalEditRows(
      (editData ?? []).map((p) =>
        toEditableParamRow({
          paramName: p.paramName,
          paramValue: p.paramValue ?? '',
          description: p.description ?? '',
        }),
      ),
    )
  }, [isEditMode, editParamsQuery.data])

  /**
   * 선택 EQP 변경 또는 버전 목록 갱신 시 버전 기본 선택값을 조정합니다.
   * selectedEqpId가 없으면 (none/gateway_group 상태) 빈 문자열로 초기화합니다.
   */
  useEffect(() => {
    if (!selectedEqpId) {
      setAppliedVersion(EMPTY_VERSION_VALUE)
      return
    }

    if (versionOptions.length === 0) {
      setAppliedVersion(EMPTY_VERSION_VALUE)
      return
    }

    setAppliedVersion((previous) =>
      previous && versionOptions.includes(previous) ? previous : versionOptions[0],
    )
  }, [selectedEqpId, versionOptions])

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
    // 그룹 선택 시 eqpList 캐시 무효화 → 최신 설비 목록 반영
    void queryClient.invalidateQueries({ queryKey: eqpQueryKeys.list() })
    selectGatewayGroup(groupIndex)
  }, [queryClient, selectGatewayGroup])

  const handleSaveCreateEqp = async (request: EqpCreateRequest) => {
    try {
      setManagementErrorMessage(null)
      await createEqpMutation.mutateAsync(request)
      closeManagementDialog()
      handleSelectEqp(request.eqpId)
    } catch (error) {
      setManagementErrorMessage(resolveErrorMessage(error, '설비 등록에 실패했습니다.'))
    }
  }

  const handleSaveEqpUpdate = async (request: EqpUpdateRequest) => {
    if (!managementTargetEqpId) {
      setManagementErrorMessage('선택된 설비 정보가 없어 저장할 수 없습니다.')
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
      setManagementErrorMessage(resolveErrorMessage(error, '설비 수정에 실패했습니다.'))
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
        message: `${targetEqpId} 설비가 정상적으로 삭제되었습니다.`,
      })
    } catch (error) {
      closeManagementDialog()
      setDeleteResultDialog({
        open: true,
        status: 'failure',
        eqpId: targetEqpId,
        message: resolveErrorMessage(error, '설비 삭제에 실패했습니다.'),
      })
    }
  }

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
      setCheckInErrorMessage(resolveErrorMessage(error, '체크아웃에 실패했습니다.'))
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
      return '저장할 파라미터가 없습니다. 행 추가로 행을 만들거나 Undo로 체크아웃을 취소해 주세요.'
    }

    if (hasBlankParamName) {
      return 'Param Name은 비어 있을 수 없습니다.'
    }

    if (duplicatedParamNames.length > 0) {
      return `중복된 Param Name이 있습니다: ${duplicatedParamNames[0]}`
    }

    return null
  }, [duplicatedParamNames, hasBlankParamName, isEditMode, isEditParamRowsLoading, localEditRows.length])

  /**
   * Save 버튼 클릭: 로컬 편집 행을 DB EDIT 버전으로 저장합니다.
   */
  const handleSaveEditParams = async () => {
    if (!selectedEqpId) {
      return
    }

    if (localEditRows.length === 0) {
      setCheckInErrorMessage('저장할 파라미터가 없습니다. 행 추가로 행을 추가하거나 Undo를 사용해 주세요.')
      return
    }

    if (hasBlankParamName) {
      setCheckInErrorMessage('Param Name은 비어 있을 수 없습니다.')
      return
    }

    if (duplicatedParamNames.length > 0) {
      setCheckInErrorMessage(`중복된 Param Name이 있습니다: ${duplicatedParamNames[0]}`)
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
      setCheckInErrorMessage(resolveErrorMessage(error, 'EDIT 파라미터 저장에 실패했습니다.'))
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
      setCheckInErrorMessage(resolveErrorMessage(error, '체크아웃 되돌리기에 실패했습니다.'))
    }
  }

  /**
   * CheckInModal의 Save 클릭: 서버가 자동 생성한 버전으로 체크인합니다.
   */
  const handleCheckInSave = async (description: string) => {
    if (!selectedEqpId) {
      setCheckInErrorMessage('선택된 설비 정보가 없어 저장할 수 없습니다.')
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
      setCheckInErrorMessage(resolveErrorMessage(error, '체크인 중 오류가 발생했습니다.'))
    }
  }

  /**
   * 로그아웃 API 호출 후 로컬 UI 상태/캐시를 정리하고 로그인 페이지로 이동합니다.
   */
  const handleLogout = async () => {
    if (isLogoutPending) {
      return
    }

    setIsLogoutPending(true)

    try {
      await authApi.logout()
    } catch (error) {
      console.warn('[EqpPage] logout request failed, continuing with local cleanup', error)
    } finally {
      clearDeployUiSessionState()
      setProfileModalOpen(false)
      resetSelectionTransientStates()
      closeManagementDialog()
      queryClient.clear()
      clearCsrfCookie()
      navigate(LOGIN_ROUTE, { replace: true })
    }
  }

  // 현재 파라미터 테이블에 표시할 행
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
      return checkedOutBy ? `${checkedOutBy}님이 편집 중` : '편집 중'
    }
    // 읽기 모드: 첫 번째 파라미터의 description 표시
    const firstParam = readParamsQuery.data?.[0]
    return firstParam?.description ?? ''
  }, [isEditMode, checkoutStatus, readParamsQuery.data])

  const listErrorMessage = eqpListQuery.error
    ? resolveErrorMessage(eqpListQuery.error, '설비 목록을 불러오지 못했습니다.')
    : null
  const versionErrorMessage = eqpParamVersionsQuery.error
    ? resolveErrorMessage(eqpParamVersionsQuery.error, '버전 목록을 불러오지 못했습니다.')
    : null
  const managementDetailErrorMessage = needsManageDetail && eqpManageDetailQuery.error
    ? resolveErrorMessage(eqpManageDetailQuery.error, '설비 관리 상세 정보를 불러오지 못했습니다.')
    : null
  const managementOptionsErrorMessage = needsManageOptions && eqpManageOptionsQuery.error
    ? resolveErrorMessage(eqpManageOptionsQuery.error, '설비 관리 옵션을 불러오지 못했습니다.')
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
  const handleNavigateMenu = (route: string | null) => {
    if (!route || route === '/eqp') {
      return
    }
    navigate(route)
  }

  return (
    <div className="flex min-h-screen w-screen flex-col bg-[#F7FAF8]">
      <header className="relative flex h-[52px] items-center justify-between bg-white px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-[#d95d39]">
            <span className="font-fraunces text-sm font-medium text-white">N</span>
          </div>
          <span className="font-fraunces text-lg text-[#2D2D2D]">Nori-TC</span>
        </div>

        {/* topbar nav는 사이드바 폭에 관계없이 항상 헤더 중앙에 고정됩니다.
            좌우 여백을 동일하게(164px) 설정하여 버튼 영역과 겹치지 않도록 합니다. */}
        <div
          className="pointer-events-none absolute inset-y-0 hidden items-center justify-center md:flex"
          style={{ left: '164px', right: '164px' }}
        >
          <nav className="pointer-events-auto flex max-w-full items-center gap-6 overflow-hidden whitespace-nowrap">
            {TOP_NAVIGATION_ITEMS.map((menuItem) => {
              const isCurrentMenu = menuItem.name === 'Eqp'
              return (
                <button
                  key={menuItem.name}
                  type="button"
                  onClick={() => handleNavigateMenu(menuItem.route)}
                  className={`group relative inline-flex h-[38px] items-center px-2 text-[14px] font-medium tracking-[0.01em] transition-colors ${
                    isCurrentMenu
                      ? 'text-[#173f31]'
                      : 'text-[#6A7971] hover:text-[#2B4A3F]'
                  }`}
                >
                  <span>{menuItem.name}</span>
                  <span
                    className={`pointer-events-none absolute -bottom-px left-0 right-0 h-[2px] rounded-full transition-opacity ${
                      isCurrentMenu
                        ? 'bg-[#1C7F59] opacity-100'
                        : 'bg-[#1C7F59] opacity-0 group-hover:opacity-35'
                    }`}
                  />
                </button>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-[38px] rounded-full border-[#DCE5E0] px-3.5 text-sm font-medium text-[#4B5A52]"
            onClick={() => void handleLogout()}
            disabled={isLogoutPending}
            aria-label="로그아웃"
          >
            {isLogoutPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
            로그아웃
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="size-[38px] rounded-full border border-[#DCE5E0] text-[#4B5A52]"
            onClick={() => setProfileModalOpen(true)}
            aria-label="사용자 프로필 열기"
            disabled={isLogoutPending}
          >
            <CircleUserRound className="size-[18px]" />
          </Button>
        </div>
      </header>

      <div className="h-px bg-[#E5ECE7]" />

      {/* main: flex-1로 남은 화면 전체 높이 차지, min-h-0으로 flex shrink 허용 */}
      <main className="flex flex-1 min-h-0">
        <EqpSidebar
          eqpItems={eqpItems}
          selectedEqpId={selectedEqpId}
          selectedGroupIndex={selectedGroupIndex}
          sidebarOpen={sidebarOpen}
          sidebarWidth={sidebarWidth}
          isLoading={eqpListQuery.isLoading}
          errorMessage={listErrorMessage}
          onSelectEqp={handleSelectEqp}
          onSelectGatewayGroup={handleSelectGatewayGroup}
          onOpenEqpInfoUpdate={openEqpInfoDialog}
          onOpenEqpModelBinding={openEqpModelDialog}
          onOpenEqpParamVersion={openEqpParamDialog}
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
              <div className="flex flex-1 items-center justify-center text-sm text-[#8A8A8A]">
                설비 또는 게이트웨이 그룹을 선택해 주세요.
              </div>
            ) : selection.type === 'gateway_group' ? (
              /* gateway_app 그룹 선택: 설비 목록 테이블 (파라미터/Checkout 없음) */
              <section className="flex flex-1 flex-col p-3 md:p-4">
                <GatewayGroupTable eqpItems={gatewayGroupItems} groupName={selectedGroupName} />
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
                    eqp={eqpDetailQuery.data ?? null}
                    modelInfo={eqpModelInfoQuery.data ?? null}
                    runtimeState={eqpRuntimeStateQuery.data ?? null}
                    isLoading={eqpDetailQuery.isLoading}
                    isFetching={
                      eqpDetailQuery.isFetching || eqpRuntimeStateQuery.isFetching || eqpModelInfoQuery.isFetching
                    }
                  />
                </div>

                {/* 드래그 핸들: 위아래 패널 크기 조절 (15% ~ 85%) */}
                <ResizableDivider onDrag={handleDividerDrag} />

                {/* 하단 패널: 버전 선택 + Check Out/In + 파라미터 테이블 */}
                <div
                  style={{ height: `${100 - topPanelHeightPercent}%` }}
                  className="min-h-0 p-3 pt-0 md:p-4 md:pt-0"
                >
                  <section className="flex h-full min-h-0 flex-col rounded-2xl border border-[#E4EAE6] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex h-[34px] items-center gap-1.5">
                        <select
                          value={appliedVersion}
                          onChange={(event) => setAppliedVersion(event.target.value)}
                          disabled={isEditMode || versionOptions.length === 0 || eqpParamVersionsQuery.isLoading}
                          className="h-8 min-w-[232px] rounded-lg border border-[#97A8A1] bg-white px-2.5 text-xs font-medium text-[#1E3D33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C7F59]/30 disabled:cursor-not-allowed disabled:bg-[#F5F8F6] disabled:text-[#8A8A8A]"
                        >
                          {versionOptions.length === 0 ? (
                            <option value={EMPTY_VERSION_VALUE}>{NO_VERSION_OPTION_LABEL}</option>
                          ) : (
                            versionOptions.map((version) => (
                              <option key={version} value={version}>
                                {version}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEditMode ? (
                          <>
                            {/* Undo 버튼: 현재 체크아웃과 EDIT 행 전체를 취소 */}
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-[10px] border-[#B8C9C1] bg-[#F3F7F5] px-3 text-xs font-semibold text-[#1E3D33]"
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
                              className="h-8 rounded-[10px] border-[#B8C9C1] bg-[#F3F7F5] px-3 text-xs font-semibold text-[#1E3D33]"
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
                              className="h-8 rounded-[10px] border-[#B8C9C1] bg-[#F3F7F5] px-3 text-xs font-semibold text-[#1E3D33]"
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
                            className="h-8 rounded-[10px] border-[#B8C9C1] bg-[#F3F7F5] px-3 text-xs font-semibold text-[#1E3D33]"
                            onClick={() => void handleCheckOut()}
                            disabled={isCheckoutDisabled}
                            title={
                              checkoutStatus.isCheckedOut && checkoutStatus.checkedOutBy
                                ? `${checkoutStatus.checkedOutBy}님이 체크아웃 중`
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

                    {/* Mode 텍스트 영역: 읽기 모드는 첫 파라미터 description, 편집 모드는 "누구님이 편집 중" */}
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      <span className={`${isEditMode ? 'font-medium text-[#7C9082]' : 'text-[#8A8A8A]'}`}>
                        {modeDescriptionText}
                      </span>
                    </div>

                    {checkInErrorMessage ? (
                      <p className="mt-2 text-xs text-[#C5534B]">{checkInErrorMessage}</p>
                    ) : null}

                    {versionErrorMessage ? (
                      <p className="mt-2 text-xs text-[#C5534B]">{versionErrorMessage}</p>
                    ) : null}

                    {!checkInErrorMessage && paramEditValidationMessage ? (
                      <p className="mt-2 text-xs text-[#C5534B]">{paramEditValidationMessage}</p>
                    ) : null}

                    <div className="mt-3 min-h-0 flex-1 border-t border-[#E4EAE6] pt-3">
                      <EqpParamTable
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
        errorMessage={checkInErrorMessage}
        onOpenChange={setIsCheckInModalOpen}
        onSave={(description) => void handleCheckInSave(description)}
        onCancel={() => setIsCheckInModalOpen(false)}
      />

      <EqpManageFormModal
        open={managementDialog.type === 'create' || managementDialog.type === 'info'}
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

      <EqpParamVersionModal
        open={managementDialog.type === 'param'}
        detail={managementDialog.type === 'param' ? eqpManageDetailQuery.data ?? null : null}
        isLoading={eqpManageDetailQuery.isLoading}
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
            setDeleteResultDialog(EMPTY_EQP_DELETE_RESULT_DIALOG_STATE)
          }
        }}
      />

      <UserProfileModal open={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  )
}
