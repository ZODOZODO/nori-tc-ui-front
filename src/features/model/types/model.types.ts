import type { ApiResponse as BaseApiResponse } from '@/shared/types/api.types'
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
  | 'plc-group'
  | 'plc-register'
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
 * PLC 계열 상세 노드 순서입니다.
 *
 * - plc-group = 읽기 명령 카탈로그(message_name·area·주소·read_count·poll_period_ms),
 *   plc-register = 디코드 변수(평면 테이블, Group 컬럼으로 소속 그룹 지정). PLC 전용 노드.
 * - model-parameter / mes-message / mdf / dcop-itemes 는 protocol 무관 공통 노드 —
 *   PLC 도 모델 파라미터(PORTCOUNT 등)·MES 메시지·MES 보고 포맷(MDF)·데이터 수집(DCOP)을 가지므로 포함.
 *   dcop-itemes 는 PLC 에서 SECS 레이아웃(EventId 컬럼 포함, event 미사용 시 빈값)으로 동작한다.
 */
export const PLC_DETAIL_NODES: ModelDetailNode[] = [
  'model-parameter',
  'plc-group',
  'plc-register',
  'mes-message',
  'mdf',
  'dcop-itemes',
]

/**
 * plc-group Message Name 은 gateway 가 Kafka eventType(metadata.eventType)으로 그대로 발행하고
 * Business 가 KafkaEventTypeNamingPolicy 로 검증한다 — 위반 시 폴링 메시지가 거부(silent drop)된다.
 * 그래서 동일 규칙(대문자 시작, 대문자/숫자/언더스코어만)으로 입력을 사전 검증한다.
 * 원본 패턴: nori-tc-common KafkaEventTypeNamingPolicy.DEFAULT_EVENT_TYPE_PATTERN
 */
export const PLC_GROUP_MESSAGE_NAME_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/

/** plc-group Message Name 형식 유효성(공백 트림 후 검사). */
export const isValidPlcGroupMessageName = (value: string): boolean =>
  PLC_GROUP_MESSAGE_NAME_PATTERN.test(value.trim())

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
  'plc-group': 'PLC Group',
  'plc-register': 'PLC Register',
  workflow: 'Flow',
  mdf: 'MDF',
  'dcop-itemes': 'Dcop Itemes',
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
 *
 * dcop-flow-binding v4 에서 `workflowName` 컬럼이 BE 응답에서 제거되어 dcop_item 본체는
 * model_version 단위 pool 의 원소로만 유지된다. Flow 와의 binding 은 join table
 * `tc_model_message_flow_dcop_item` 으로 분리 — picker 모달이 dcop_item_key 배열 단위
 * 로 N:M 매핑을 관리한다.
 */
export interface ModelDcopItem {
  dcopItemKey: number | null
  modelVersionKey: number
  dcopItemName: string
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
 * - Collect: dcopItems (Flow 에 binding 된 dcop_item 본체) + dcopItemKeys (PUT round-trip
 *   용 key 배열). v4 에서 BE 가 두 표현을 동시 노출 — `dcopItemKeys` 는 picker 모달이
 *   그대로 다음 PUT 에 송신.
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
  dcopItemKeys: number[]
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
 *
 * `dcopItemKeys` 는 Collect 섹션의 N:M binding 갱신 — null = Collect 미갱신, 빈 배열 =
 * 기존 binding 전부 정리. DcopItemPickerModal save 시에만 값 (PK 배열) 으로 채움.
 */
export interface ModelFlowUpdateRequest {
  workflowName: string
  messageName: string
  eventId: string | null
  transactionId: string | null
  workflowFilter: string | null
  actionName: string
  actionDataIndex: string | null
  dcopItemKeys: number[] | null
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

