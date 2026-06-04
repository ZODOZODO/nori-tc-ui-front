import type { ApiResponse } from '@/features/auth/types/auth.types'
import type { ModelStatus, ProtocolType } from '@/shared/types/domain.types'
import i18n from '@/i18n'

export type { ModelStatus, ProtocolType } from '@/shared/types/domain.types'

/**
 * 설비 통신 인터페이스 타입입니다.
 * 백엔드 enum 변경 가능성을 고려해 string fallback을 허용합니다.
 */
export type EqpInterfaceType = ProtocolType

/**
 * GET /api/eqp, GET /api/eqp/{eqpId} 응답의 설비 단건 모델입니다.
 */
export interface EqpInfo {
  eqpKey: number
  eqpId: string
  commInterface: EqpInterfaceType
  commMode: string
  isDev: boolean
  routePartition: number | null
  eqpIp: string
  eqpPort: number
  modelVersionKey: number
  enabled: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

/**
 * 선택 설비의 연결 모델 정보 응답 모델입니다.
 * /api/model/{modelVersionKey}에서 필요한 필드만 매핑합니다.
 */
export interface EqpModelInfo {
  modelVersionKey: number
  modelKey: number
  modelName: string
  parentModel: string | null
  modelVersion: string
  commInterface: ProtocolType
  status: ModelStatus
  description: string | null
  maker: string | null
}

/**
 * 선택 설비의 런타임 상태 응답 모델입니다.
 * /api/eqp/{eqpId}/runtime-state 조회 결과를 사용합니다.
 */
export interface EqpRuntimeState {
  controlState: string | null
  eqpState: string | null
  connectionState: string | null
}

// =========================================================================
// EQP 선택 상태 모델
// =========================================================================

/**
 * EQP 페이지의 선택 상태를 표현하는 유니온 타입입니다.
 * - none: 초기 진입 또는 선택 없음
 * - gateway_all: Gateway 전체 선택 (전체 게이트웨이 설비 목록 테이블 표시)
 * - business_all: Business 전체 선택 (전체 비즈니스 앱의 모델 목록 테이블 표시)
 * - gateway_group: gateway_app 그룹 선택 (해당 그룹의 설비 목록 테이블 표시)
 * - business_group: business_app 그룹 선택 (해당 그룹 설비가 참조하는 모델 목록 표시)
 * - eqp: 개별 설비 선택 (설비 정보 + 파라미터/Checkout 영역 표시)
 */
export type EqpSelection =
  | { type: 'none' }
  | { type: 'gateway_all' }
  | { type: 'business_all' }
  | { type: 'gateway_group'; groupIndex: number }
  | { type: 'business_group'; groupIndex: number }
  | { type: 'eqp'; eqpId: string }

// =========================================================================
// 사이드바 그룹 모델
// =========================================================================

/**
 * gateway_app 그룹 모델입니다.
 * route_partition을 2개씩 묶어 그룹화합니다.
 * 예: [0,1] → gateway_app1, [2,3] → gateway_app2
 */
export interface GatewayAppGroup {
  appIndex: number
  appName: string
  items: EqpInfo[]
}

/**
 * business_app 그룹 모델입니다.
 * route_partition을 6개씩 묶어 그룹화합니다.
 * 예: [0..5] → business_app1, [6..11] → business_app2
 */
export interface BusinessAppGroup {
  appIndex: number
  appName: string
  items: EqpInfo[]
}

/**
 * 페이지네이션된 설비 목록 payload 입니다.
 */
export interface EqpInfoPage {
  items: EqpInfo[]
  offset: number
  limit: number
  count: number
}

/**
 * EQP 목록 조회 응답 타입입니다.
 */
export type EqpInfoListResponse = ApiResponse<EqpInfoPage>

/**
 * EQP 단건 조회 응답 타입입니다.
 */
export type EqpInfoDetailResponse = ApiResponse<EqpInfo>

/**
 * EQP 파라미터 버전 목록 조회 응답 타입입니다.
 */
export type EqpParamVersionListResponse = ApiResponse<string[]>

/**
 * 모델 상세 조회 응답 타입입니다.
 */
export type EqpModelInfoResponse = ApiResponse<EqpModelInfo>

/**
 * 설비 런타임 상태 조회 응답 타입입니다.
 */
export type EqpRuntimeStateResponse = ApiResponse<EqpRuntimeState>

/**
 * EQP 관리 화면 로그 정책 요청/응답 공통 모델입니다.
 */
export interface EqpLogSettings {
  logLevel: string | null
  logRetentionDays: number | null
  logPath: string | null
}

/**
 * EQP 관리 화면 SECS 전용 설정 요청/응답 공통 모델입니다.
 */
export interface EqpHsmsSettings {
  deviceId: number | null
  t3Timeout: number | null
  t5Timeout: number | null
  t6Timeout: number | null
  t7Timeout: number | null
  t8Timeout: number | null
  linkTestEnabled: boolean | null
  linkTestInterval: number | null
  maxMsgBytes: number | null
}

/**
 * EQP 관리 화면 SOCKET 전용 설정 요청/응답 공통 모델입니다.
 */
export interface EqpSocketSettings {
  socketProtocolType: string | null
  charset: string | null
  heartbeatEnabled: boolean | null
  heartbeatInterval: number | null
  readTimeout: number | null
  writeTimeout: number | null
  maxFrameSizeBytes: number | null
  keepAliveEnabled: boolean | null
}

/**
 * EQP 관리 화면 jar 바인딩 응답 모델입니다.
 */
export interface EqpJarBinding {
  gatewayJarRef: number | null
  gatewayJarFileName: string | null
  businessJarRef: number | null
  businessJarFileName: string | null
}

/**
 * EQP 관리 화면 jar 선택 옵션 응답 모델입니다.
 */
export interface EqpJarOption {
  jarRef: number
  jarFileName: string
}

/**
 * EQP 관리 화면 model 바인딩 응답 모델입니다.
 */
export interface EqpModelBinding {
  modelVersionKey: number | null
  modelKey: number | null
  modelName: string | null
  parentModel: string | null
  modelVersion: string | null
  commInterface: ProtocolType | null
  status: ModelStatus | null
}

/**
 * EQP 관리 화면 파라미터 버전 옵션 응답 모델입니다.
 */
export interface EqpParamVersionOption {
  paramVersion: string
  description: string | null
}

/**
 * EQP 관리 화면 port 상태 응답 모델입니다.
 */
export interface EqpPortStatus {
  portId: string | null
  portType: string | null
  portState: string | null
  carrierId: string | null
  carrierType: string | null
  carrierState: string | null
  updatedAt: string | null
}

/**
 * EQP 관리 상세 응답 모델입니다.
 */
export interface EqpManageDetail {
  eqpId: string
  lineKey: number
  commInterface: ProtocolType
  commMode: string
  isDev: boolean
  routePartition: number | null
  eqpIp: string
  eqpPort: number
  enabled: boolean
  runtimeState: EqpRuntimeState | null
  logPolicy: EqpLogSettings | null
  jars: EqpJarBinding | null
  modelBinding: EqpModelBinding | null
  hsmsSettings: EqpHsmsSettings | null
  socketSettings: EqpSocketSettings | null
  appliedParamVersion: string | null
  appliedParamDescription: string | null
  paramVersions: EqpParamVersionOption[]
  portStatuses: EqpPortStatus[]
}

/**
 * EQP 관리 화면 모델 옵션 응답 모델입니다.
 */
export interface EqpModelOption {
  modelVersionKey: number
  modelKey: number
  modelName: string
  parentModel: string | null
  modelVersion: string
  commInterface: ProtocolType
  status: ModelStatus
}

/**
 * EQP 관리 화면 옵션 응답 모델입니다.
 */
export interface EqpManageOptions {
  socketProtocolTypes: string[]
  gatewayJarOptions: EqpJarOption[]
  businessJarOptions: EqpJarOption[]
  developModelOptions: EqpModelOption[]
  operateModelOptions: EqpModelOption[]
}

/**
 * EQP 관리 상세 조회 응답 타입입니다.
 */
export type EqpManageDetailResponse = ApiResponse<EqpManageDetail>

/**
 * EQP 관리 상세 일괄 조회 데이터 모델입니다.
 *
 * - items: 요청한 eqpId 중 실제로 조회된 항목들의 상세 (입력 순서 보존)
 * - missingEqpIds: 요청에는 있었으나 DB에 존재하지 않아 결과에 빠진 eqpId 목록
 */
export interface EqpManageDetailBatch {
  items: EqpManageDetail[]
  missingEqpIds: string[]
}

/**
 * EQP 관리 상세 일괄 조회 응답 타입입니다.
 */
export type EqpManageDetailBatchApiResponse = ApiResponse<EqpManageDetailBatch>

/**
 * EQP 관리 화면 옵션 조회 응답 타입입니다.
 */
export type EqpManageOptionsResponse = ApiResponse<EqpManageOptions>

/**
 * EQP 생성 요청 DTO 입니다.
 */
export interface EqpCreateRequest {
  eqpId: string
  lineKey: number
  interfaceType: EqpInterfaceType
  commMode: string
  isDev: boolean
  routePartition: number
  eqpIp: string
  eqpPort: number
  modelVersionKey: number
  appliedParamVersion?: string | null
  gatewayJarRef?: number | null
  businessJarRef?: number | null
  logSettings?: EqpLogSettings | null
  hsmsSettings?: EqpHsmsSettings | null
  socketSettings?: EqpSocketSettings | null
}

/**
 * EQP 수정 요청 DTO 입니다.
 */
export interface EqpUpdateRequest {
  lineKey: number
  commMode: string
  isDev: boolean
  routePartition: number
  eqpIp: string
  eqpPort: number
  modelVersionKey: number
  appliedParamVersion?: string | null
  gatewayJarRef?: number | null
  businessJarRef?: number | null
  logSettings?: EqpLogSettings | null
  hsmsSettings?: EqpHsmsSettings | null
  socketSettings?: EqpSocketSettings | null
}

/**
 * EQP start/end 요청 DTO 입니다.
 */
export interface EqpLifecycleRequest {
  interfaceType: EqpInterfaceType
  uiMessage?: string | null
}

/**
 * create/update/delete 계열의 공통 응답 타입입니다.
 */
export type EqpDualCommandResponse = ApiResponse<null>

/**
 * START/END 202 Accepted 응답 payload 입니다.
 */
export interface AsyncAcceptData {
  traceId: string
}

/**
 * START/END 요청의 즉시 응답 타입입니다.
 */
export type AsyncAcceptResponse = ApiResponse<AsyncAcceptData>

/**
 * GET /api/async/{traceId} polling 결과 payload 입니다.
 */
export interface AsyncResultData {
  traceId: string
  eqpId: string | null
  status: 'PENDING' | 'PASS' | 'FAIL' | 'TIMEOUT' | (string & {})
  errorCode: string | null
  errorMsg: string | null
}

/**
 * polling 결과 응답 타입입니다.
 */
export type AsyncResultResponse = ApiResponse<AsyncResultData>

/**
 * EQP Parameter UI 전용 행 모델입니다.
 * 현재 전용 API가 없으므로 화면 상태로 관리합니다.
 */
export interface EqpParamRow {
  paramName: string
  paramValue: string
  description: string
}

/**
 * 실패 응답 payload 최소 타입입니다.
 */
export type EqpFailResponse = ApiResponse<null> & {
  success: false
  data: null
  errorCode: string
  errorMsg: string
}

/**
 * EQP API 계층 공통 기본 오류 메시지입니다.
 * 모듈 로드 시점이 아니라 호출 시점에 i18n.t 를 평가해야 런타임 언어 전환을 반영한다.
 */
export const defaultEqpErrorMessage = (): string => i18n.t('error.eqp.default')

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * 런타임 응답 구조가 ApiResponse 계약인지 검사합니다.
 */
export const isApiResponse = <TData = unknown>(value: unknown): value is ApiResponse<TData> => {
  if (!isRecord(value)) {
    return false
  }

  const hasSuccess = typeof value.success === 'boolean'
  const hasData = 'data' in value
  const hasErrorCode = value.errorCode === null || typeof value.errorCode === 'string'
  const hasErrorMsg = value.errorMsg === null || typeof value.errorMsg === 'string'

  return hasSuccess && hasData && hasErrorCode && hasErrorMsg
}

/**
 * 알 수 없는 실패 payload를 EqpFailResponse 형태로 정규화합니다.
 */
export const createEqpFailResponse = (
  payload: unknown,
  fallbackMessage = defaultEqpErrorMessage(),
): EqpFailResponse => {
  if (isApiResponse(payload) && payload.success === false) {
    return {
      success: false,
      data: null,
      errorCode:
        typeof payload.errorCode === 'string' && payload.errorCode.length > 0
          ? payload.errorCode
          : 'UNKNOWN_ERROR',
      errorMsg:
        typeof payload.errorMsg === 'string' && payload.errorMsg.length > 0
          ? payload.errorMsg
          : fallbackMessage,
    }
  }

  return {
    success: false,
    data: null,
    errorCode: 'UNKNOWN_ERROR',
    errorMsg: fallbackMessage,
  }
}

/**
 * EQP API 레이어 전용 에러 객체입니다.
 * status가 있으면 HTTP 상태코드를 함께 전달합니다.
 */
export class EqpApiError extends Error {
  public readonly payload: EqpFailResponse
  public readonly status?: number

  constructor(payload: EqpFailResponse, status?: number) {
    super(payload.errorMsg)
    this.name = 'EqpApiError'
    this.payload = payload
    this.status = status
  }
}

// =========================================================================
// Check Out / Check In 관련 타입
// =========================================================================

/**
 * tc_eqp_param 파라미터 단건 모델입니다.
 * GET /api/eqp/{eqpId}/params?version={version} 응답에 사용됩니다.
 */
export interface EqpParam {
  paramName: string
  paramValue: string | null
  description: string | null
  createdBy: string
}

/**
 * 설비 체크아웃 상태 모델입니다.
 * GET /api/eqp/{eqpId}/checkout-status 응답에 사용됩니다.
 */
export interface EqpCheckoutStatus {
  isCheckedOut: boolean
  checkedOutBy: string | null
}

/**
 * 체크아웃 요청 DTO입니다.
 */
export interface EqpCheckoutRequest {
  sourceVersion: string
}

/**
 * 파라미터 단건 수정 항목입니다.
 */
export interface EqpParamSaveItem {
  paramName: string
  paramValue: string
  description: string
}

/**
 * 체크인 요청 DTO입니다.
 */
export interface EqpCheckinRequest {
  description: string
}

/**
 * 파라미터 목록 조회 응답 타입입니다.
 */
export type EqpParamListResponse = ApiResponse<EqpParam[]>

/**
 * 체크아웃 상태 조회 응답 타입입니다.
 * 백엔드 응답의 checkedOut 필드를 isCheckedOut으로 매핑합니다.
 */
export type EqpCheckoutStatusResponse = ApiResponse<{
  checkedOut: boolean
  checkedOutBy: string | null
}>
