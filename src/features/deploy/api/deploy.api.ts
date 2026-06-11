import { isAxiosError } from 'axios'
import i18n from '@/i18n'
import { isApiResponse, type ApiResponse } from '@/features/auth/types/auth.types'
import { apiClient } from '@/shared/lib/api-client'
import type {
  DeployCreateRequest,
  DeployCreateResult,
  DeployActionResult,
  DeployHistoryItem,
  DeployHistoryPage,
  DeployMonitorFilters,
  DeployRegisterScenarioCandidate,
  DeployRegisterScenarioPreviewRequest,
  DeployRegisterScenarioPreviewResult,
  DeployScenarioCatalogResponse,
  DeployScenarioSummary,
  DeployRegisterFilters,
  DeployRegisterTargetItem,
  DeployRegisterTargetPage,
  DeployStatus,
  DeploySummary,
  DeployTargetItem,
  DeployTargetPage,
} from '../types/deploy.types'

// 모듈 로드 시점이 아니라 호출 시점에 i18n.t 를 평가해야 런타임 언어 전환을 반영한다.
// (default 파라미터 식은 호출마다 평가되므로 fallback 이 현재 언어를 따른다.)
const fallbackRegisterTargetsError = () => i18n.t('error.deploy.registerTargets')
const fallbackCreateError = () => i18n.t('error.deploy.create')
const fallbackHistoryError = () => i18n.t('error.deploy.history')
const fallbackSummaryError = () => i18n.t('error.deploy.summary')
const fallbackTargetsError = () => i18n.t('error.deploy.targets')
const fallbackStartError = () => i18n.t('error.deploy.start')
const fallbackHoldError = () => i18n.t('error.deploy.hold')
const fallbackCancelError = () => i18n.t('error.deploy.cancel')
const fallbackRedeployError = () => i18n.t('error.deploy.redeploy')
const fallbackDeleteError = () => i18n.t('error.deploy.delete')
const fallbackScenarioError = () => i18n.t('error.deploy.scenarios')
const fallbackScenarioPreviewError = () => i18n.t('error.deploy.scenarioPreview')
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'

type DeployFailResponse = ApiResponse<null> & {
  success: false
  data: null
  errorCode: string
  errorMsg: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const DEPLOY_STATUS_VALUES = [
  'PLANNING',
  'READY',
  'RUNNING',
  'COMPLETED',
  'PARTIAL_FAILED',
  'FAILED',
  'CANCELED',
] as const satisfies readonly DeployStatus[]

const DEPLOY_TARGET_STATUS_VALUES = [
  'PENDING',
  'NO_CHANGE',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'ROLLING_BACK',
  'ROLLED_BACK',
  'COMPENSATION_FAILED',
  'CANCELED',
] as const

const DEPLOY_STEP_STATUS_VALUES = [
  'PENDING',
  'SKIPPED',
  'RUNNING',
  'WAITING_REPLY',
  'COMPLETED',
  'FAILED',
  'ROLLING_BACK',
  'ROLLED_BACK',
  'COMPENSATION_FAILED',
  'CANCELED',
] as const

const isDeployStatus = (value: unknown): value is DeployStatus =>
  typeof value === 'string' &&
  DEPLOY_STATUS_VALUES.includes(value as (typeof DEPLOY_STATUS_VALUES)[number])

const isDeployTargetStatus = (value: unknown): value is DeployTargetItem['targetStatus'] =>
  typeof value === 'string' &&
  DEPLOY_TARGET_STATUS_VALUES.includes(value as (typeof DEPLOY_TARGET_STATUS_VALUES)[number])

const isDeployStepStatus = (value: unknown): value is DeployTargetItem['currentStepStatus'] =>
  typeof value === 'string' &&
  DEPLOY_STEP_STATUS_VALUES.includes(value as (typeof DEPLOY_STEP_STATUS_VALUES)[number])

const DEPLOY_EXECUTION_POLICY_VALUES = ['BEST_EFFORT', 'FAIL_FAST'] as const

const isDeployExecutionPolicy = (
  value: unknown,
): value is (typeof DEPLOY_EXECUTION_POLICY_VALUES)[number] =>
  typeof value === 'string' &&
  DEPLOY_EXECUTION_POLICY_VALUES.includes(
    value as (typeof DEPLOY_EXECUTION_POLICY_VALUES)[number],
  )

const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }

  const encodedName = `${encodeURIComponent(name)}=`
  const targetCookie = document.cookie
    .split('; ')
    .find((cookieEntry) => cookieEntry.startsWith(encodedName))

  if (!targetCookie) {
    return null
  }

  return decodeURIComponent(targetCookie.substring(encodedName.length))
}

const createDeployFailResponse = (
  payload: unknown,
  fallbackMessage = fallbackRegisterTargetsError(),
): DeployFailResponse => {
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

const issueCsrfToken = async (): Promise<string> => {
  await apiClient.get('/auth/csrf', {
    withCredentials: true,
  })

  const csrfToken = getCookieValue(CSRF_COOKIE_NAME)
  if (!csrfToken) {
    throw new DeployApiError(
      createDeployFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'CSRF_TOKEN_MISSING',
          errorMsg: i18n.t('error.deploy.csrf'),
        },
        fallbackCreateError(),
      ),
    )
  }

  return csrfToken
}

export class DeployApiError extends Error {
  public readonly payload: DeployFailResponse
  public readonly status?: number

  constructor(payload: DeployFailResponse, status?: number) {
    super(payload.errorMsg)
    this.name = 'DeployApiError'
    this.payload = payload
    this.status = status
  }
}

const normalizeDeployError = (
  error: unknown,
  fallbackMessage = fallbackRegisterTargetsError(),
): DeployApiError => {
  if (error instanceof DeployApiError) {
    return error
  }

  if (isAxiosError(error)) {
    return new DeployApiError(
      createDeployFailResponse(error.response?.data, fallbackMessage),
      error.response?.status,
    )
  }

  return new DeployApiError(createDeployFailResponse(error, fallbackMessage))
}

const resolveSuccessPayload = <TData>(
  payload: unknown,
  status: number,
  fallbackMessage: string,
): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true || payload.data === null) {
    throw new DeployApiError(createDeployFailResponse(payload, fallbackMessage), status)
  }

  return payload.data
}

const withCsrfHeaders = async <TResponse>(
  requestFn: (csrfToken: string) => Promise<TResponse>,
): Promise<TResponse> => {
  const csrfToken = await issueCsrfToken()
  return requestFn(csrfToken)
}

const isDeployRegisterTargetItem = (value: unknown): value is DeployRegisterTargetItem =>
  isRecord(value) &&
  typeof value.eqpId === 'string' &&
  value.eqpId.length > 0 &&
  typeof value.commInterface === 'string'

const normalizeDeployRegisterTargetItem = (
  value: unknown,
): DeployRegisterTargetItem | null => {
  if (!isDeployRegisterTargetItem(value)) {
    return null
  }

  return {
    eqpKey: typeof value.eqpKey === 'number' ? value.eqpKey : null,
    eqpId: value.eqpId,
    commInterface: value.commInterface,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : false,
    modelVersionKey: typeof value.modelVersionKey === 'number' ? value.modelVersionKey : null,
    modelName: typeof value.modelName === 'string' ? value.modelName : null,
    modelVersion: typeof value.modelVersion === 'string' ? value.modelVersion : null,
    modelStatus: typeof value.modelStatus === 'string' ? value.modelStatus : null,
    businessJarRef: typeof value.businessJarRef === 'number' ? value.businessJarRef : null,
    businessJarFileName:
      typeof value.businessJarFileName === 'string' ? value.businessJarFileName : null,
    appliedParamVersion:
      typeof value.appliedParamVersion === 'string' ? value.appliedParamVersion : null,
    blockedByActiveDeploy:
      typeof value.blockedByActiveDeploy === 'boolean' ? value.blockedByActiveDeploy : false,
    activeDeployKey: typeof value.activeDeployKey === 'number' ? value.activeDeployKey : null,
    activeDeployStatus: isDeployStatus(value.activeDeployStatus) ? value.activeDeployStatus : null,
    activeDeployName:
      typeof value.activeDeployName === 'string' ? value.activeDeployName : null,
    activeRequestedBy:
      typeof value.activeRequestedBy === 'string' ? value.activeRequestedBy : null,
  }
}

const isDeployTargetItemPayload = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  typeof value.deployTargetKey === 'number' &&
  typeof value.eqpId === 'string' &&
  typeof value.targetStatus === 'string' &&
  typeof value.updatedAt === 'string'

const normalizeDeployTargetItem = (value: unknown): DeployTargetItem | null => {
  if (!isDeployTargetItemPayload(value)) {
    return null
  }

  return {
    deployTargetKey: value.deployTargetKey as number,
    eqpId: value.eqpId as string,
    targetStatus: isDeployTargetStatus(value.targetStatus) ? value.targetStatus : 'PENDING',
    currentStepOrder: typeof value.currentStepOrder === 'number' ? value.currentStepOrder : null,
    currentStepCode: typeof value.currentStepCode === 'string' ? value.currentStepCode : null,
    currentStepStatus: isDeployStepStatus(value.currentStepStatus) ? value.currentStepStatus : null,
    rollbackRequired: typeof value.rollbackRequired === 'boolean' ? value.rollbackRequired : false,
    lastErrorCode: typeof value.lastErrorCode === 'string' ? value.lastErrorCode : null,
    lastErrorMessage: typeof value.lastErrorMessage === 'string' ? value.lastErrorMessage : null,
    updatedAt: value.updatedAt as string,
  }
}

const isDeployScenarioSummary = (value: unknown): value is DeployScenarioSummary =>
  isRecord(value) &&
  typeof value.code === 'string' &&
  value.code.length > 0 &&
  typeof value.name === 'string' &&
  typeof value.summary === 'string' &&
  typeof value.version === 'number' &&
  typeof value.stepCount === 'number'

const isDeployRegisterScenarioCandidate = (
  value: unknown,
): value is DeployRegisterScenarioCandidate =>
  isRecord(value) &&
  typeof value.code === 'string' &&
  value.code.length > 0 &&
  typeof value.name === 'string' &&
  typeof value.summary === 'string' &&
  typeof value.version === 'number' &&
  typeof value.stepCount === 'number' &&
  Array.isArray(value.coversChangeKinds) &&
  typeof value.recommended === 'boolean' &&
  typeof value.selectable === 'boolean' &&
  typeof value.reason === 'string'

const isDeployHistoryItem = (value: unknown): value is DeployHistoryItem =>
  isRecord(value) &&
  typeof value.deployKey === 'number' &&
  typeof value.deployName === 'string' &&
  typeof value.eventType === 'string' &&
  typeof value.deployStatus === 'string' &&
  typeof value.executionPolicy === 'string' &&
  typeof value.requestedBy === 'string' &&
  typeof value.createdAt === 'string' &&
  isRecord(value.targetSummary)

const normalizeDeployHistoryItem = (value: unknown): DeployHistoryItem | null => {
  if (!isDeployHistoryItem(value)) {
    return null
  }

  return {
    deployKey: value.deployKey,
    deployName: value.deployName,
    eventType: value.eventType,
    deployStatus: isDeployStatus(value.deployStatus) ? value.deployStatus : 'PLANNING',
    pauseRequested: typeof value.pauseRequested === 'boolean' ? value.pauseRequested : false,
    executionPolicy:
      typeof value.executionPolicy === 'string' ? value.executionPolicy : 'BEST_EFFORT',
    requestedBy: value.requestedBy,
    createdAt: value.createdAt,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    terminal: typeof value.terminal === 'boolean' ? value.terminal : false,
    interfaceType: typeof value.interfaceType === 'string' ? value.interfaceType : null,
    selectedModelName:
      typeof value.selectedModelName === 'string' ? value.selectedModelName : null,
    selectedModelVersion:
      typeof value.selectedModelVersion === 'string' ? value.selectedModelVersion : null,
    selectedBusinessJarName:
      typeof value.selectedBusinessJarName === 'string'
        ? value.selectedBusinessJarName
        : null,
    targetSummary: isRecord(value.targetSummary)
      ? {
          total: typeof value.targetSummary.total === 'number' ? value.targetSummary.total : 0,
          pending:
            typeof value.targetSummary.pending === 'number' ? value.targetSummary.pending : 0,
          noChange:
            typeof value.targetSummary.noChange === 'number' ? value.targetSummary.noChange : 0,
          running:
            typeof value.targetSummary.running === 'number' ? value.targetSummary.running : 0,
          completed:
            typeof value.targetSummary.completed === 'number'
              ? value.targetSummary.completed
              : 0,
          failed: typeof value.targetSummary.failed === 'number' ? value.targetSummary.failed : 0,
          rollingBack:
            typeof value.targetSummary.rollingBack === 'number'
              ? value.targetSummary.rollingBack
              : 0,
          rolledBack:
            typeof value.targetSummary.rolledBack === 'number'
              ? value.targetSummary.rolledBack
              : 0,
          compensationFailed:
            typeof value.targetSummary.compensationFailed === 'number'
              ? value.targetSummary.compensationFailed
              : 0,
          canceled:
            typeof value.targetSummary.canceled === 'number' ? value.targetSummary.canceled : 0,
        }
      : {
          total: 0,
          pending: 0,
          noChange: 0,
          running: 0,
          completed: 0,
          failed: 0,
          rollingBack: 0,
          rolledBack: 0,
          compensationFailed: 0,
          canceled: 0,
        },
  }
}

const normalizeRegisterTargetPage = (
  payload: unknown,
  requestedOffset: number,
  requestedLimit: number,
): DeployRegisterTargetPage => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new DeployApiError(createDeployFailResponse(payload))
  }

  const items = payload.items
    .map((item) => normalizeDeployRegisterTargetItem(item))
    .filter((item): item is DeployRegisterTargetItem => item !== null)
  const offset = typeof payload.offset === 'number' ? payload.offset : requestedOffset
  const limit = typeof payload.limit === 'number' ? payload.limit : requestedLimit
  const count = typeof payload.count === 'number' ? Math.max(payload.count, items.length) : items.length

  return {
    items,
    offset,
    limit,
    count,
  }
}

const normalizeDeployHistoryPage = (
  payload: unknown,
  requestedOffset: number,
  requestedLimit: number,
): DeployHistoryPage => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new DeployApiError(
      createDeployFailResponse(payload, fallbackHistoryError()),
    )
  }

  const items = payload.items
    .map((item) => normalizeDeployHistoryItem(item))
    .filter((item): item is DeployHistoryItem => item !== null)
  const offset = typeof payload.offset === 'number' ? payload.offset : requestedOffset
  const limit = typeof payload.limit === 'number' ? payload.limit : requestedLimit
  const count = typeof payload.count === 'number' ? Math.max(payload.count, items.length) : items.length

  return {
    items,
    offset,
    limit,
    count,
  }
}

const normalizeDeployTargetPage = (
  payload: unknown,
  requestedPage: number,
  requestedSize: number,
): DeployTargetPage => {
  if (!isRecord(payload) || !Array.isArray(payload.targets)) {
    throw new DeployApiError(createDeployFailResponse(payload, fallbackTargetsError()))
  }

  return {
    deployKey: typeof payload.deployKey === 'number' ? payload.deployKey : 0,
    page: typeof payload.page === 'number' ? payload.page : requestedPage,
    size: typeof payload.size === 'number' ? payload.size : requestedSize,
    totalElements:
      typeof payload.totalElements === 'number'
        ? payload.totalElements
        : payload.targets.length,
    totalPages: typeof payload.totalPages === 'number' ? payload.totalPages : 1,
    targets: payload.targets
      .map((target) => normalizeDeployTargetItem(target))
      .filter((target): target is DeployTargetItem => target !== null),
  }
}

const normalizeDeployActionResult = (
  payload: unknown,
  fallbackMessage = fallbackCancelError(),
): DeployActionResult => {
  if (!isRecord(payload) || typeof payload.deployKey !== 'number') {
    throw new DeployApiError(createDeployFailResponse(payload, fallbackMessage))
  }

  return {
    deployKey: payload.deployKey,
    deployStatus: isDeployStatus(payload.deployStatus) ? payload.deployStatus : null,
    pauseRequested: typeof payload.pauseRequested === 'boolean' ? payload.pauseRequested : null,
    deleted: typeof payload.deleted === 'boolean' ? payload.deleted : null,
    resultCode: typeof payload.resultCode === 'string' ? payload.resultCode : null,
    resultMessage: isRecord(payload.resultMessage)
      ? {
          title: typeof payload.resultMessage.title === 'string' ? payload.resultMessage.title : '',
          message:
            typeof payload.resultMessage.message === 'string' ? payload.resultMessage.message : '',
          severity:
            typeof payload.resultMessage.severity === 'string'
              ? payload.resultMessage.severity
              : 'INFO',
        }
      : null,
  }
}

const normalizeDeploySummary = (payload: unknown): DeploySummary => {
  if (!isRecord(payload) || typeof payload.deployKey !== 'number' || typeof payload.deployName !== 'string') {
    throw new DeployApiError(createDeployFailResponse(payload, fallbackSummaryError()))
  }

  return {
    deployKey: payload.deployKey,
    deployName: payload.deployName,
    eventType: typeof payload.eventType === 'string' ? payload.eventType : 'EQP_REGISTER_DEPLOY',
    resolvedScenarioCode:
      typeof payload.resolvedScenarioCode === 'string' ? payload.resolvedScenarioCode : null,
    asIsState: isRecord(payload.asIsState)
      ? {
          interfaceType:
            typeof payload.asIsState.interfaceType === 'string' ? payload.asIsState.interfaceType : null,
          modelName: typeof payload.asIsState.modelName === 'string' ? payload.asIsState.modelName : null,
          modelVersion:
            typeof payload.asIsState.modelVersion === 'string' ? payload.asIsState.modelVersion : null,
          businessJarName:
            typeof payload.asIsState.businessJarName === 'string' ? payload.asIsState.businessJarName : null,
          eqpParamVersion:
            typeof payload.asIsState.eqpParamVersion === 'string' ? payload.asIsState.eqpParamVersion : null,
        }
      : null,
    deployStatus: isDeployStatus(payload.deployStatus) ? payload.deployStatus : 'PLANNING',
    pauseRequested: typeof payload.pauseRequested === 'boolean' ? payload.pauseRequested : false,
    executionPolicy:
      isDeployExecutionPolicy(payload.executionPolicy) ? payload.executionPolicy : 'BEST_EFFORT',
    createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : '',
    startedAt: typeof payload.startedAt === 'string' ? payload.startedAt : null,
    finishedAt: typeof payload.finishedAt === 'string' ? payload.finishedAt : null,
    targetSummary: isRecord(payload.targetSummary)
      ? {
          total: typeof payload.targetSummary.total === 'number' ? payload.targetSummary.total : 0,
          pending:
            typeof payload.targetSummary.pending === 'number' ? payload.targetSummary.pending : 0,
          noChange:
            typeof payload.targetSummary.noChange === 'number' ? payload.targetSummary.noChange : 0,
          running:
            typeof payload.targetSummary.running === 'number' ? payload.targetSummary.running : 0,
          completed:
            typeof payload.targetSummary.completed === 'number'
              ? payload.targetSummary.completed
              : 0,
          failed: typeof payload.targetSummary.failed === 'number' ? payload.targetSummary.failed : 0,
          rollingBack:
            typeof payload.targetSummary.rollingBack === 'number'
              ? payload.targetSummary.rollingBack
              : 0,
          rolledBack:
            typeof payload.targetSummary.rolledBack === 'number'
              ? payload.targetSummary.rolledBack
              : 0,
          compensationFailed:
            typeof payload.targetSummary.compensationFailed === 'number'
              ? payload.targetSummary.compensationFailed
              : 0,
          canceled:
            typeof payload.targetSummary.canceled === 'number' ? payload.targetSummary.canceled : 0,
        }
      : {
          total: 0,
          pending: 0,
          noChange: 0,
          running: 0,
          completed: 0,
          failed: 0,
          rollingBack: 0,
          rolledBack: 0,
          compensationFailed: 0,
          canceled: 0,
        },
    terminal: typeof payload.terminal === 'boolean' ? payload.terminal : false,
    popupRequired: typeof payload.popupRequired === 'boolean' ? payload.popupRequired : false,
    resultCode: typeof payload.resultCode === 'string' ? payload.resultCode : null,
    resultMessage: isRecord(payload.resultMessage)
      ? {
          title: typeof payload.resultMessage.title === 'string' ? payload.resultMessage.title : '',
          message:
            typeof payload.resultMessage.message === 'string' ? payload.resultMessage.message : '',
          severity:
            typeof payload.resultMessage.severity === 'string'
              ? payload.resultMessage.severity
              : 'INFO',
        }
      : null,
  }
}

const normalizeDeployScenarioCatalog = (payload: unknown): DeployScenarioCatalogResponse => {
  if (!isRecord(payload) || !Array.isArray(payload.scenarios) || typeof payload.scenarioCount !== 'number') {
    throw new DeployApiError(createDeployFailResponse(payload, fallbackScenarioError()))
  }

  const scenarios = payload.scenarios.filter(isDeployScenarioSummary)

  return {
    catalogVersion: typeof payload.catalogVersion === 'number' ? payload.catalogVersion : 0,
    catalogChecksum: typeof payload.catalogChecksum === 'string' ? payload.catalogChecksum : '',
    loadedAt: typeof payload.loadedAt === 'string' ? payload.loadedAt : '',
    loadedBy: typeof payload.loadedBy === 'string' ? payload.loadedBy : '',
    reloadReason: typeof payload.reloadReason === 'string' ? payload.reloadReason : '',
    scenarioCount: payload.scenarioCount,
    scenarios,
  }
}

const normalizeDeployRegisterScenarioPreview = (
  payload: unknown,
): DeployRegisterScenarioPreviewResult => {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.removedEqpIds) ||
    !Array.isArray(payload.remainingEqpIds) ||
    !Array.isArray(payload.unionChangeKinds) ||
    !Array.isArray(payload.scenarios)
  ) {
    throw new DeployApiError(
      createDeployFailResponse(payload, fallbackScenarioPreviewError()),
    )
  }

  return {
    removedEqpIds: payload.removedEqpIds.filter((value): value is string => typeof value === 'string'),
    remainingEqpIds: payload.remainingEqpIds.filter((value): value is string => typeof value === 'string'),
    unionChangeKinds: payload.unionChangeKinds.filter((value): value is string => typeof value === 'string'),
    recommendedScenarioCode:
      typeof payload.recommendedScenarioCode === 'string' ? payload.recommendedScenarioCode : null,
    recommendedReason:
      typeof payload.recommendedReason === 'string'
        ? payload.recommendedReason
        : i18n.t('error.deploy.recommendedReasonFallback'),
    scenarios: payload.scenarios.filter(isDeployRegisterScenarioCandidate),
  }
}

export const deployApi = {
  getRegisterTargets: async (
    filters: DeployRegisterFilters,
    lineKey: number | null,
    offset = 0,
    limit = 500,
  ): Promise<DeployRegisterTargetPage> => {
    try {
      const response = await apiClient.get('/deploys/register/targets', {
        params: {
          offset,
          limit,
          ...(filters.modelName ? { modelName: filters.modelName } : {}),
          ...(filters.modelVersionKey !== null ? { modelVersionKey: filters.modelVersionKey } : {}),
          ...(filters.eqpId ? { eqpId: filters.eqpId } : {}),
          ...(lineKey !== null ? { lineKey } : {}),
        },
        withCredentials: true,
      })

      return normalizeRegisterTargetPage(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          fallbackRegisterTargetsError(),
        ),
        offset,
        limit,
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackRegisterTargetsError())
    }
  },

  createDeploy: async (request: DeployCreateRequest): Promise<DeployCreateResult> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post('/deploys', request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<DeployCreateResult>(
        response.data,
        response.status,
        fallbackCreateError(),
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackCreateError())
    }
  },

  startDeploy: async (deployKey: number): Promise<DeployActionResult> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post(`/deploys/${deployKey}/start`, null, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return normalizeDeployActionResult(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          fallbackStartError(),
        ),
        fallbackStartError(),
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackStartError())
    }
  },

  holdDeploy: async (deployKey: number): Promise<DeployActionResult> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post(`/deploys/${deployKey}/hold`, null, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return normalizeDeployActionResult(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          fallbackHoldError(),
        ),
        fallbackHoldError(),
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackHoldError())
    }
  },

  cancelDeploy: async (deployKey: number): Promise<DeployActionResult> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post(`/deploys/${deployKey}/cancel`, null, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return normalizeDeployActionResult(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          fallbackCancelError(),
        ),
        fallbackCancelError(),
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackCancelError())
    }
  },

  redeployDeploy: async (deployKey: number): Promise<DeployCreateResult> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post(`/deploys/${deployKey}/redeploy`, null, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<DeployCreateResult>(
        response.data,
        response.status,
        fallbackRedeployError(),
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackRedeployError())
    }
  },

  deleteDeploy: async (deployKey: number): Promise<DeployActionResult> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete(`/deploys/${deployKey}`, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return normalizeDeployActionResult(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          fallbackDeleteError(),
        ),
        fallbackDeleteError(),
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackDeleteError())
    }
  },

  getScenarios: async (eventType: string): Promise<DeployScenarioCatalogResponse> => {
    try {
      const response = await apiClient.get('/deploys/scenarios', {
        params: { eventType },
        withCredentials: true,
      })

      return normalizeDeployScenarioCatalog(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          fallbackScenarioError(),
        ),
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackScenarioError())
    }
  },

  previewRegisterScenario: async (
    request: DeployRegisterScenarioPreviewRequest,
  ): Promise<DeployRegisterScenarioPreviewResult> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post('/deploys/register/scenario-preview', request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return normalizeDeployRegisterScenarioPreview(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          fallbackScenarioPreviewError(),
        ),
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackScenarioPreviewError())
    }
  },

  getDeployHistory: async (
    filters: DeployMonitorFilters,
    terminalOnly: boolean,
    offset = 0,
    limit = 50,
  ): Promise<DeployHistoryPage> => {
    try {
      const response = await apiClient.get('/deploys', {
        params: {
          offset,
          limit,
          terminalOnly,
          ...(filters.modelName ? { modelName: filters.modelName } : {}),
          ...(filters.requestedBy ? { requestedBy: filters.requestedBy } : {}),
          ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
          ...(filters.toDate ? { toDate: filters.toDate } : {}),
        },
        withCredentials: true,
      })

      return normalizeDeployHistoryPage(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          fallbackHistoryError(),
        ),
        offset,
        limit,
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackHistoryError())
    }
  },

  getDeploySummary: async (deployKey: number): Promise<DeploySummary> => {
    try {
      const response = await apiClient.get(`/deploys/${deployKey}`, {
        withCredentials: true,
      })

      return normalizeDeploySummary(
        resolveSuccessPayload<unknown>(response.data, response.status, fallbackSummaryError()),
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackSummaryError())
    }
  },

  getDeployTargets: async (
    deployKey: number,
    page = 0,
    size = 50,
    status: string | null = null,
    eqpId: string | null = null,
  ): Promise<DeployTargetPage> => {
    try {
      const response = await apiClient.get(`/deploys/${deployKey}/targets`, {
        params: {
          page,
          size,
          ...(status ? { status } : {}),
          ...(eqpId ? { eqpId } : {}),
        },
        withCredentials: true,
      })

      return normalizeDeployTargetPage(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          fallbackTargetsError(),
        ),
        page,
        size,
      )
    } catch (error) {
      throw normalizeDeployError(error, fallbackTargetsError())
    }
  },
}
