import { isAxiosError } from 'axios'
import { isApiResponse, type ApiResponse } from '@/features/auth/types/auth.types'
import { apiClient } from '@/shared/lib/api-client'
import type {
  DeployCreateRequest,
  DeployCreateResult,
  DeployActionResult,
  DeployHistoryItem,
  DeployHistoryPage,
  DeployMonitorFilters,
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

const DEFAULT_DEPLOY_ERROR_MESSAGE = 'Deploy 대상 설비 목록을 조회하지 못했습니다.'
const DEFAULT_DEPLOY_CREATE_ERROR_MESSAGE = 'Deploy 생성에 실패했습니다.'
const DEFAULT_DEPLOY_HISTORY_ERROR_MESSAGE = 'Deploy 목록을 조회하지 못했습니다.'
const DEFAULT_DEPLOY_SUMMARY_ERROR_MESSAGE = 'Deploy 정보를 조회하지 못했습니다.'
const DEFAULT_DEPLOY_TARGETS_ERROR_MESSAGE = 'Deploy 대상 상태를 조회하지 못했습니다.'
const DEFAULT_DEPLOY_CANCEL_ERROR_MESSAGE = 'Deploy 취소에 실패했습니다.'
const DEFAULT_DEPLOY_REDEPLOY_ERROR_MESSAGE = 'Deploy 재실행에 실패했습니다.'
const DEFAULT_DEPLOY_DELETE_ERROR_MESSAGE = 'Deploy 이력 삭제에 실패했습니다.'
const DEFAULT_DEPLOY_SCENARIO_ERROR_MESSAGE = '시나리오 목록을 조회하지 못했습니다.'
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

const isDeployStatus = (value: unknown): value is DeployStatus =>
  typeof value === 'string' &&
  DEPLOY_STATUS_VALUES.includes(value as (typeof DEPLOY_STATUS_VALUES)[number])

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
  fallbackMessage = DEFAULT_DEPLOY_ERROR_MESSAGE,
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
          errorMsg: 'CSRF 토큰을 확인할 수 없습니다. 페이지를 새로고침한 후 다시 시도해 주세요.',
        },
        DEFAULT_DEPLOY_CREATE_ERROR_MESSAGE,
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
  fallbackMessage = DEFAULT_DEPLOY_ERROR_MESSAGE,
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

const isDeployTargetItem = (value: unknown): value is DeployTargetItem =>
  isRecord(value) &&
  typeof value.deployTargetKey === 'number' &&
  typeof value.eqpId === 'string' &&
  typeof value.targetStatus === 'string' &&
  typeof value.currentStepCode === 'string' &&
  typeof value.updatedAt === 'string'

const isDeployScenarioSummary = (value: unknown): value is DeployScenarioSummary =>
  isRecord(value) &&
  typeof value.code === 'string' &&
  value.code.length > 0 &&
  typeof value.name === 'string' &&
  typeof value.summary === 'string' &&
  typeof value.version === 'number' &&
  typeof value.stepCount === 'number'

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

const normalizeRegisterTargetPage = (
  payload: unknown,
  requestedOffset: number,
  requestedLimit: number,
): DeployRegisterTargetPage => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new DeployApiError(createDeployFailResponse(payload))
  }

  const items = payload.items.filter(isDeployRegisterTargetItem)
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
      createDeployFailResponse(payload, DEFAULT_DEPLOY_HISTORY_ERROR_MESSAGE),
    )
  }

  const items = payload.items.filter(isDeployHistoryItem)
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
    throw new DeployApiError(createDeployFailResponse(payload, DEFAULT_DEPLOY_TARGETS_ERROR_MESSAGE))
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
    targets: payload.targets.filter(isDeployTargetItem),
  }
}

const normalizeDeployActionResult = (payload: unknown): DeployActionResult => {
  if (!isRecord(payload) || typeof payload.deployKey !== 'number') {
    throw new DeployApiError(createDeployFailResponse(payload, DEFAULT_DEPLOY_CANCEL_ERROR_MESSAGE))
  }

  return {
    deployKey: payload.deployKey,
    deployStatus: isDeployStatus(payload.deployStatus) ? payload.deployStatus : null,
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

const normalizeDeployScenarioCatalog = (payload: unknown): DeployScenarioCatalogResponse => {
  if (!isRecord(payload) || !Array.isArray(payload.scenarios) || typeof payload.scenarioCount !== 'number') {
    throw new DeployApiError(createDeployFailResponse(payload, DEFAULT_DEPLOY_SCENARIO_ERROR_MESSAGE))
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

export const deployApi = {
  getRegisterTargets: async (
    filters: DeployRegisterFilters,
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
        },
        withCredentials: true,
      })

      return normalizeRegisterTargetPage(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          DEFAULT_DEPLOY_ERROR_MESSAGE,
        ),
        offset,
        limit,
      )
    } catch (error) {
      throw normalizeDeployError(error, DEFAULT_DEPLOY_ERROR_MESSAGE)
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
        DEFAULT_DEPLOY_CREATE_ERROR_MESSAGE,
      )
    } catch (error) {
      throw normalizeDeployError(error, DEFAULT_DEPLOY_CREATE_ERROR_MESSAGE)
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
          DEFAULT_DEPLOY_CANCEL_ERROR_MESSAGE,
        ),
      )
    } catch (error) {
      throw normalizeDeployError(error, DEFAULT_DEPLOY_CANCEL_ERROR_MESSAGE)
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
        DEFAULT_DEPLOY_REDEPLOY_ERROR_MESSAGE,
      )
    } catch (error) {
      throw normalizeDeployError(error, DEFAULT_DEPLOY_REDEPLOY_ERROR_MESSAGE)
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
          DEFAULT_DEPLOY_DELETE_ERROR_MESSAGE,
        ),
      )
    } catch (error) {
      throw normalizeDeployError(error, DEFAULT_DEPLOY_DELETE_ERROR_MESSAGE)
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
          DEFAULT_DEPLOY_SCENARIO_ERROR_MESSAGE,
        ),
      )
    } catch (error) {
      throw normalizeDeployError(error, DEFAULT_DEPLOY_SCENARIO_ERROR_MESSAGE)
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
          DEFAULT_DEPLOY_HISTORY_ERROR_MESSAGE,
        ),
        offset,
        limit,
      )
    } catch (error) {
      throw normalizeDeployError(error, DEFAULT_DEPLOY_HISTORY_ERROR_MESSAGE)
    }
  },

  getDeploySummary: async (deployKey: number): Promise<DeploySummary> => {
    try {
      const response = await apiClient.get(`/deploys/${deployKey}`, {
        withCredentials: true,
      })

      return resolveSuccessPayload<DeploySummary>(
        response.data,
        response.status,
        DEFAULT_DEPLOY_SUMMARY_ERROR_MESSAGE,
      )
    } catch (error) {
      throw normalizeDeployError(error, DEFAULT_DEPLOY_SUMMARY_ERROR_MESSAGE)
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
          DEFAULT_DEPLOY_TARGETS_ERROR_MESSAGE,
        ),
        page,
        size,
      )
    } catch (error) {
      throw normalizeDeployError(error, DEFAULT_DEPLOY_TARGETS_ERROR_MESSAGE)
    }
  },
}
