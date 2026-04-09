import type { ApiResponse } from '@/features/auth/types/auth.types'
import type { ModelStatus, ProtocolType } from '@/shared/types/domain.types'

export type DeployMode = 'register' | 'deploy' | 'history'

export type DeployEventType =
  | 'EQP_BUSINESS_JARFILE_UPDATE'
  | 'EQP_REGISTER_DEPLOY'
  | (string & {})

export type DeployExecutionPolicy = 'BEST_EFFORT' | 'FAIL_FAST'

export type DeployStatus =
  | 'PLANNING'
  | 'READY'
  | 'RUNNING'
  | 'COMPLETED'
  | 'PARTIAL_FAILED'
  | 'FAILED'
  | 'CANCELED'

export type DeployTargetStatus =
  | 'PENDING'
  | 'NO_CHANGE'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK'
  | 'COMPENSATION_FAILED'
  | 'CANCELED'

export type DeployStepStatus =
  | 'PENDING'
  | 'SKIPPED'
  | 'RUNNING'
  | 'WAITING_REPLY'
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK'
  | 'COMPENSATION_FAILED'
  | 'CANCELED'

export interface DeployTargetSummary {
  total: number
  pending: number
  noChange: number
  running: number
  completed: number
  failed: number
  rollingBack: number
  rolledBack: number
  compensationFailed: number
  canceled: number
}

export interface DeployRegisterEqpItem {
  eqpId: string
  modelName: string
  modelVersion: string
  modelVersionKey: number
  businessJarFileName: string
  eqpParamVersion: string
  eqpParamVersionOptions: string[]
  commInterface: ProtocolType
  status: ModelStatus
}

export interface DeployRegisterTargetItem {
  eqpKey: number | null
  eqpId: string
  commInterface: ProtocolType
  enabled: boolean
  modelVersionKey: number | null
  modelName: string | null
  modelVersion: string | null
  modelStatus: ModelStatus | null
  businessJarRef: number | null
  businessJarFileName: string | null
  appliedParamVersion: string | null
  blockedByActiveDeploy: boolean
  activeDeployKey: number | null
  activeDeployStatus: DeployStatus | null
  activeDeployName: string | null
  activeRequestedBy: string | null
}

export interface DeployRegisterTargetPage {
  items: DeployRegisterTargetItem[]
  offset: number
  limit: number
  count: number
}

export type DeployRegisterTargetPageResponse = ApiResponse<DeployRegisterTargetPage>

export interface DeployModelOption {
  modelName: string
  interfaceType: ProtocolType
}

export interface DeployModelVersionOption {
  modelVersionKey: number
  modelName: string
  modelVersion: string
  status: ModelStatus
  interfaceType: ProtocolType
}

export interface DeployJarOption {
  jarRef: number
  jarFileName: string
  sourceType?: 'DB' | (string & {})
  expectedSha256?: string
}

export interface DeployHistoryItem {
  deployKey: number
  deployName: string
  eventType: DeployEventType
  deployStatus: DeployStatus
  pauseRequested: boolean
  executionPolicy: DeployExecutionPolicy
  requestedBy: string
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  terminal: boolean
  interfaceType: ProtocolType | null
  selectedModelName: string | null
  selectedModelVersion: string | null
  selectedBusinessJarName: string | null
  targetSummary: DeployTargetSummary
}

export interface DeployHistoryPage {
  items: DeployHistoryItem[]
  offset: number
  limit: number
  count: number
}

export interface DeployTargetItem {
  deployTargetKey: number
  eqpId: string
  modelName?: string
  targetStatus: DeployTargetStatus
  currentStepOrder: number | null
  currentStepCode: string | null
  currentStepStatus: DeployStepStatus | null
  rollbackRequired: boolean
  lastErrorCode?: string | null
  lastErrorMessage: string | null
  updatedAt: string
}

export interface DeployRegisterFilters {
  modelName: string
  modelVersionKey: number | null
  eqpId: string
}

export interface DeployScenarioSummary {
  code: string
  name: string
  summary: string
  version: number
  stepCount: number
}

export interface DeployScenarioCatalogResponse {
  catalogVersion: number
  catalogChecksum: string
  loadedAt: string
  loadedBy: string
  reloadReason: string
  scenarioCount: number
  scenarios: DeployScenarioSummary[]
}

export interface DeployRegisterScenarioCandidate {
  code: string
  name: string
  summary: string
  version: number
  stepCount: number
  coversChangeKinds: string[]
  recommended: boolean
  selectable: boolean
  reason: string
}

export interface DeployRegisterScenarioPreviewRequest {
  commonRequest: {
    interfaceType: ProtocolType
    uiMessage: Record<string, unknown>
  }
  targets: Array<{
    eqpId: string
    uiMessageOverride?: Record<string, unknown> | null
  }>
}

export interface DeployRegisterScenarioPreviewResult {
  removedEqpIds: string[]
  remainingEqpIds: string[]
  unionChangeKinds: string[]
  recommendedScenarioCode: string | null
  recommendedReason: string
  scenarios: DeployRegisterScenarioCandidate[]
}

export interface DeployMonitorFilters {
  modelName: string
  requestedBy: string
  fromDate: string
  toDate: string
}

export interface CreateLocalDeployInput {
  requestedBy: string
  selectedModelVersion: string | null
  selectedBusinessJarName: string | null
}

export interface DeployResultMessage {
  title: string
  message: string
  severity: string
}

export interface DeployCreateRequest {
  deployName: string
  eventType: DeployEventType
  executionPolicy: DeployExecutionPolicy
  commonRequest: {
    interfaceType: ProtocolType
    uiMessage: Record<string, unknown>
    resolvedScenarioCode?: string
  }
  targets: Array<{
    eqpId: string
    uiMessageOverride?: Record<string, unknown> | null
  }>
}

export interface DeployCreateResult {
  deployKey: number
  deployStatus: DeployStatus
  polling: {
    summaryUrl: string
    targetsUrl: string
  }
  resultCode: string | null
  resultMessage: DeployResultMessage | null
}

export type DeployCreateResponse = ApiResponse<DeployCreateResult>

export interface DeployActionResult {
  deployKey: number
  deployStatus: DeployStatus | null
  pauseRequested: boolean | null
  deleted: boolean | null
  resultCode: string | null
  resultMessage: DeployResultMessage | null
}

export type DeployActionResponse = ApiResponse<DeployActionResult>

export type DeployHistoryPageResponse = ApiResponse<DeployHistoryPage>

export interface DeploySummary {
  deployKey: number
  deployName: string
  eventType: DeployEventType
  resolvedScenarioCode: string | null
  asIsState: {
    interfaceType: string | null
    modelName: string | null
    modelVersion: string | null
    businessJarName: string | null
    eqpParamVersion: string | null
  } | null
  deployStatus: DeployStatus
  pauseRequested: boolean
  executionPolicy: DeployExecutionPolicy
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  targetSummary: DeployTargetSummary
  terminal: boolean
  popupRequired: boolean
  resultCode: string | null
  resultMessage: DeployResultMessage | null
}

export type DeploySummaryResponse = ApiResponse<DeploySummary>

export interface DeployTargetPage {
  deployKey: number
  page: number
  size: number
  totalElements: number
  totalPages: number
  targets: DeployTargetItem[]
}

export type DeployTargetPageResponse = ApiResponse<DeployTargetPage>
