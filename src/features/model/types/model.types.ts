import type { ApiResponse as BaseApiResponse } from '@/features/auth/types/auth.types'
import type { ModelStatus, ProtocolType } from '@/shared/types/domain.types'

export type { ModelStatus, ProtocolType } from '@/shared/types/domain.types'

/**
 * Model 도메인에서도 auth와 동일한 ApiResponse 래퍼 계약을 사용합니다.
 */
export type ApiResponse<TData> = BaseApiResponse<TData>

/**
 * GET /api/model, GET /api/model/{modelVersionKey} 공통 단건 모델입니다.
 */
export interface ModelInfo {
  modelVersionKey: number
  modelKey: number
  modelName: string
  parentModel: string | null
  modelVersion: string
  commInterface: ProtocolType
  status: ModelStatus
  description: string | null
  maker: string | null
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

/**
 * 모델 목록 페이지네이션 payload 입니다.
 */
export interface ModelPageResponse {
  items: ModelInfo[]
  offset: number
  limit: number
  count: number
}

/**
 * 모델 저장(등록/수정) 요청 DTO 입니다.
 */
export interface ModelUpsertRequest {
  modelName: string
  modelVersion: string
  commInterface: ProtocolType
  status: ModelStatus
  description?: string | null
  maker?: string | null
  createdBy?: string | null
  updatedBy?: string | null
}

/**
 * root model 생성 요청 DTO입니다.
 */
export interface ModelRootCreateRequest {
  modelName: string
  commInterface: ProtocolType
  maker?: string | null
}

/**
 * root model 공통 정보 수정 요청 DTO입니다.
 */
export interface ModelInfoUpdateRequest {
  maker?: string | null
}

/**
 * branch model 생성 요청 DTO입니다.
 */
export interface ModelBranchCreateRequest {
  suffix: string
  sourceModelVersionKey?: number | null
}

/**
 * parent commit preview/실행 요청 DTO입니다.
 */
export interface ModelParentCommitRequest {
  applyCommit?: boolean | null
  newParentVersion?: string | null
}

/**
 * 모델 목록 조회 응답 타입입니다.
 */
export type ModelListResponse = ApiResponse<ModelPageResponse>

/**
 * 모델 단건 조회/등록/수정 응답 타입입니다.
 */
export type ModelDetailResponse = ApiResponse<ModelInfo>

/**
 * 모델 삭제 응답 타입입니다.
 */
export type ModelDeleteResponse = ApiResponse<null>

/**
 * deprecated branch 일괄 삭제 결과 payload 입니다.
 */
export interface ModelDeleteBatchResult {
  deletedCount: number
  deletedModelKeys: number[]
  deletedModelNames: string[]
}

/**
 * deprecated branch 일괄 삭제 응답 타입입니다.
 */
export type ModelDeleteBatchResponse = ApiResponse<ModelDeleteBatchResult>

/**
 * 모델 상세 노드 row 원본 payload 타입입니다.
 */
export interface ModelDetailRowPayload {
  id?: string | null
  values: Array<string | null>
  previewValues?: Array<string | null>
}

/**
 * MDF(XML) 원본 payload 타입입니다.
 */
export interface ModelMdfContentPayload {
  name: string
  xml: string
}

/**
 * 모델 상세 노드 원본 payload 타입입니다.
 */
export interface ModelNodeDetailPayload {
  columns: string[]
  rows: ModelDetailRowPayload[]
  mdfContents: ModelMdfContentPayload[]
}

/**
 * 모델 상세 노드 조회 응답 타입입니다.
 */
export type ModelNodeDetailResponse = ApiResponse<ModelNodeDetailPayload>

/**
 * 상세 패널 좌측 노드 타입입니다.
 */
export type ModelDetailNode =
  | 'model-parameter'
  | 'secs-message'
  | 'mes-message'
  | 'variableides'
  | 'reportides'
  | 'eventides'
  | 'socket-message'
  | 'workflow'
  | 'mdf'
  | 'dcop-itemes'

/**
 * 더블클릭으로 열린 상세 탭 모델입니다.
 */
export interface ModelOpenedTab {
  modelVersionKey: number
  modelKey: number
  modelName: string
  modelVersion: string
  commInterface: ProtocolType
}

/**
 * 상세 우측 메인 테이블의 행 모델입니다.
 */
export interface ModelDetailRow {
  id: string
  values: string[]
  previewValues: string[]
}

/**
 * MDF(XML) 렌더링 단위 모델입니다.
 */
export interface ModelMdfContent {
  id: string
  name: string
  xml: string
}

/**
 * 상세 노드 렌더링용 정규화 데이터입니다.
 */
export interface ModelNodeDetailData {
  columns: string[]
  rows: ModelDetailRow[]
  mdfContents: ModelMdfContent[]
}

/**
 * parent commit diff 항목 응답 모델입니다.
 */
export interface ModelDiffItem {
  identity: string
  branchValues: string[]
  parentValues: string[]
}

/**
 * parent commit diff 섹션 응답 모델입니다.
 */
export interface ModelDiffSection {
  detailNode: ModelDetailNode | (string & {})
  columns: string[]
  added: ModelDiffItem[]
  changed: ModelDiffItem[]
  deleted: ModelDiffItem[]
}

/**
 * parent commit preview/실행 결과 payload 입니다.
 */
export interface ModelParentCommitResult {
  committed: boolean
  branchModelKey: number
  parentModelKey: number
  branchModelName: string
  parentModelName: string
  branchLatestVersion: string
  parentLatestVersion: string
  newParentVersion: string | null
  committedParentModelVersionKey: number | null
  sections: ModelDiffSection[]
}

/**
 * root/branch 생성 및 root 정보 수정 응답 타입입니다.
 */
export type ModelManagementResponse = ApiResponse<ModelInfo>

/**
 * parent commit preview/실행 응답 타입입니다.
 */
export type ModelParentCommitResponse = ApiResponse<ModelParentCommitResult>

/**
 * SECS 계열 상세 노드 순서입니다.
 */
export const SECS_DETAIL_NODES: ModelDetailNode[] = [
  'model-parameter',
  'secs-message',
  'mes-message',
  'variableides',
  'reportides',
  'eventides',
  'workflow',
  'mdf',
  'dcop-itemes',
]

/**
 * Socket 계열 상세 노드 순서입니다.
 */
export const SOCKET_DETAIL_NODES: ModelDetailNode[] = [
  'model-parameter',
  'socket-message',
  'mes-message',
  'workflow',
  'mdf',
  'dcop-itemes',
]

/**
 * 상세 노드별 라벨 매핑입니다.
 */
export const MODEL_DETAIL_NODE_LABELS: Record<ModelDetailNode, string> = {
  'model-parameter': 'Model Parameter',
  'secs-message': 'SECS Message',
  'mes-message': 'MES Message',
  variableides: 'Variableides',
  reportides: 'ReportIdes',
  eventides: 'EventIdes',
  'socket-message': 'Socket Message',
  workflow: 'Workflow',
  mdf: 'MDF',
  'dcop-itemes': 'Dcop Itemes',
}

/**
 * 실패 응답 payload 최소 타입입니다.
 */
export type ModelFailResponse = ApiResponse<null> & {
  success: false
  data: null
  errorCode: string
  errorMsg: string
}

/**
 * Model API 계층 기본 오류 메시지입니다.
 */
export const DEFAULT_MODEL_ERROR_MESSAGE =
  '모델 정보를 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'

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
 * 알 수 없는 실패 payload를 ModelFailResponse 형태로 정규화합니다.
 */
export const createModelFailResponse = (
  payload: unknown,
  fallbackMessage = DEFAULT_MODEL_ERROR_MESSAGE,
): ModelFailResponse => {
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
 * DCOP 수집 규칙 — backend UiDcopCollectionRule enum 미러입니다.
 */
export type ModelDcopCollectionRule = 'FIRST' | 'LAST' | 'AVERAGE' | 'MIN' | 'MAX'

/**
 * Message Flow 의 Collect 섹션에서 노출되는 DCOP item 한 행입니다.
 *
 * Backend {@code UiModelDcopItem} 도메인 record 와 1:1 매핑되며,
 * Flow 편집 화면에서는 readonly 로만 사용 (편집은 dcop-itemes 노드 모달에서 별도 진행).
 */
export interface ModelDcopItem {
  dcopItemKey: number | null
  modelVersionKey: number
  dcopItemName: string
  workflowName: string
  eventId: string | null
  variableId: string
  collectionRule: ModelDcopCollectionRule
  calculationRule: string | null
  orderRule: number | null
  updatedAt: string
}

/**
 * GET /api/model/{modelVersionKey}/flows 의 목록 1 행 항목입니다.
 *
 * Flat 구조 — 트리 그룹화(workflowName 묶음)는 FE 가 담당합니다.
 */
export interface ModelFlowSummary {
  flowId: number
  workflowName: string
  messageName: string
  actionName: string
}

/**
 * GET /api/model/{modelVersionKey}/flows/{flowId} 의 4 섹션 상세 응답입니다.
 *
 * - Identity: workflowName, messageName
 * - Trigger: eventId, transactionId, workflowFilter (Socket 모델은 모두 null)
 * - Action: actionName, actionDataIndex (raw JSON string 또는 null)
 * - Collect: dcopItems (workflowName 매칭된 행만)
 */
export interface ModelFlow {
  flowId: number
  workflowName: string
  messageName: string
  eventId: string | null
  transactionId: string | null
  workflowFilter: string | null
  actionName: string
  actionDataIndex: string | null
  dcopItems: ModelDcopItem[]
}

/**
 * POST /api/model/{modelVersionKey}/flows 의 응답 payload 입니다.
 */
export interface ModelFlowCreatedData {
  flowId: number
}

/**
 * POST /api/model/{modelVersionKey}/flows 의 요청 바디입니다.
 * Identity 섹션만 입력 — Trigger / Action 은 빈 상태로 생성됩니다.
 */
export interface ModelFlowCreateRequest {
  workflowName: string
  messageName: string
}

/**
 * PUT /api/model/{modelVersionKey}/flows/{flowId} 의 요청 바디입니다.
 * 4 섹션을 한 번에 전송하며, Trigger 3 필드와 actionDataIndex 는 nullable 입니다.
 */
export interface ModelFlowUpdateRequest {
  workflowName: string
  messageName: string
  eventId: string | null
  transactionId: string | null
  workflowFilter: string | null
  actionName: string
  actionDataIndex: string | null
}

/**
 * GET /api/model/{modelVersionKey}/flows 응답 payload 입니다.
 */
export interface ModelFlowListPayload {
  items: ModelFlowSummary[]
}

/**
 * Flow 목록/상세/생성 응답 타입입니다.
 */
export type ModelFlowListResponse = ApiResponse<ModelFlowListPayload>
export type ModelFlowDetailResponse = ApiResponse<ModelFlow>
export type ModelFlowCreatedResponse = ApiResponse<ModelFlowCreatedData>

/**
 * Model API 레이어 전용 오류 객체입니다.
 */
export class ModelApiError extends Error {
  public readonly payload: ModelFailResponse
  public readonly status?: number

  constructor(payload: ModelFailResponse, status?: number) {
    super(payload.errorMsg)
    this.name = 'ModelApiError'
    this.payload = payload
    this.status = status
  }
}
