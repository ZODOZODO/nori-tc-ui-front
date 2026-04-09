import { isAxiosError } from 'axios'
import { isApiResponse, type ApiResponse } from '@/features/auth/types/auth.types'
import { apiClient } from '@/shared/lib/api-client'
import type { LiveMapDemoTestType } from '../types/live-map.types'

const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'

export interface LiveMapDemoScenarioCatalogItem {
  scenarioId: string
  version: number
  name: string
  description: string
  supportedTestTypes: LiveMapDemoTestType[]
  enabled: boolean
}

export interface LiveMapDemoJobSummary {
  jobId: string
  eqpId: string
  eqpName: string
  processType: string | null
  portId: string
  testType: LiveMapDemoTestType
  scenarioId: string
  scenarioVersion: number
  scenarioName: string
  state: string
  currentStageCode: string | null
  currentStageName: string | null
  progressPercent: number
  currentStepCount: number
  totalStepCount: number
  message: string | null
  requestedAt: string
  startedAt: string | null
  finishedAt: string | null
  updatedAt: string
  failureCode: string | null
  failureMessage: string | null
}

export interface LiveMapDemoJobEvent {
  eventSeq: number
  eventType: string
  eventSource: string
  stageCode: string | null
  message: string
  occurredAt: string
}

export interface LiveMapDemoJobDetail {
  job: LiveMapDemoJobSummary
  events: LiveMapDemoJobEvent[]
}

export interface LiveMapDemoJobRejectedEquipment {
  eqpId: string
  reasonCode: string
  reasonMessage: string
  activeJobId: string | null
}

export interface LiveMapDemoJobCreateResult {
  acceptedJobs: LiveMapDemoJobSummary[]
  rejectedEquipments: LiveMapDemoJobRejectedEquipment[]
}

export interface LiveMapDemoJobCreateRequest {
  testType: LiveMapDemoTestType
  scenarioId: string
  scenarioVersion: number
  eqpIds: string[]
  requestedBy?: string
}

const DEFAULT_ERROR_MESSAGE = 'Demo 테스트 정보를 처리하지 못했습니다.'

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

const issueCsrfToken = async (): Promise<string> => {
  await apiClient.get('/auth/csrf', {
    withCredentials: true,
  })

  const csrfToken = getCookieValue(CSRF_COOKIE_NAME)
  if (!csrfToken) {
    throw new Error('CSRF 토큰을 확인할 수 없습니다. 페이지를 새로고침한 후 다시 시도해 주세요.')
  }

  return csrfToken
}

const withCsrfHeaders = async <TResponse>(
  requestFn: (csrfToken: string) => Promise<TResponse>,
): Promise<TResponse> => {
  const csrfToken = await issueCsrfToken()
  return requestFn(csrfToken)
}

const resolveSuccessPayload = <TData>(payload: unknown, fallbackMessage: string): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true || payload.data === null) {
    const apiPayload = isApiResponse(payload) ? payload : null
    throw new Error(apiPayload?.errorMsg || fallbackMessage)
  }

  return payload.data
}

const normalizeError = (error: unknown, fallbackMessage: string): Error => {
  if (error instanceof Error) {
    return error
  }

  if (isAxiosError(error)) {
    const payload = error.response?.data
    if (isApiResponse(payload) && payload.success === false) {
      return new Error(payload.errorMsg || fallbackMessage)
    }
  }

  return new Error(fallbackMessage)
}

export const liveMapDemoApi = {
  async getScenarios(testType: LiveMapDemoTestType): Promise<LiveMapDemoScenarioCatalogItem[]> {
    try {
      const response = await apiClient.get<ApiResponse<LiveMapDemoScenarioCatalogItem[]>>(
        '/live-map/demo-scenarios',
        {
          params: { testType },
          withCredentials: true,
        },
      )
      return resolveSuccessPayload<LiveMapDemoScenarioCatalogItem[]>(
        response.data,
        'Demo 시나리오 목록을 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeError(error, 'Demo 시나리오 목록을 조회하지 못했습니다.')
    }
  },

  async createJobs(request: LiveMapDemoJobCreateRequest): Promise<LiveMapDemoJobCreateResult> {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<ApiResponse<LiveMapDemoJobCreateResult>>('/live-map/demo-jobs', request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
        }),
      )
      return resolveSuccessPayload<LiveMapDemoJobCreateResult>(
        response.data,
        'Demo 테스트 시작에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeError(error, 'Demo 테스트 시작에 실패했습니다.')
    }
  },

  async getJobs(states?: string, limit = 100): Promise<LiveMapDemoJobSummary[]> {
    try {
      const response = await apiClient.get<ApiResponse<LiveMapDemoJobSummary[]>>(
        '/live-map/demo-jobs',
        {
          params: {
            ...(states ? { states } : {}),
            limit,
          },
          withCredentials: true,
        },
      )
      return resolveSuccessPayload<LiveMapDemoJobSummary[]>(
        response.data,
        'Demo job 목록을 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeError(error, 'Demo job 목록을 조회하지 못했습니다.')
    }
  },

  async getJob(jobId: string): Promise<LiveMapDemoJobDetail> {
    try {
      const response = await apiClient.get<ApiResponse<LiveMapDemoJobDetail>>(
        `/live-map/demo-jobs/${encodeURIComponent(jobId)}`,
        { withCredentials: true },
      )
      return resolveSuccessPayload<LiveMapDemoJobDetail>(response.data, DEFAULT_ERROR_MESSAGE)
    } catch (error) {
      throw normalizeError(error, DEFAULT_ERROR_MESSAGE)
    }
  },

  async cancelJob(jobId: string): Promise<LiveMapDemoJobDetail> {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<ApiResponse<LiveMapDemoJobDetail>>(
          `/live-map/demo-jobs/${encodeURIComponent(jobId)}/cancel`,
          null,
          {
            withCredentials: true,
            headers: {
              [CSRF_HEADER_NAME]: csrfToken,
            },
          },
        ),
      )
      return resolveSuccessPayload<LiveMapDemoJobDetail>(response.data, 'Demo job 취소에 실패했습니다.')
    } catch (error) {
      throw normalizeError(error, 'Demo job 취소에 실패했습니다.')
    }
  },
}
