import { isAxiosError } from 'axios'
import i18n from '@/i18n'
import { isApiResponse, type ApiResponse } from '@/features/auth/types/auth.types'
import { apiClient } from '@/shared/lib/api-client'
import type { LiveMapDemoTestType } from '../types/live-map.types'

// 신규 simulator orchestrator Run 경로(R-1) API. 레거시 demo-tester job 경로(live-map-demo.api.ts)와 병행하며,
// 응답 형상이 job 모델과 다르다(run 1개 + targets[]; progress%/stage 없음). CSRF/에러 헬퍼는 job 파일을 손대지
// 않고 cutover 시 함께 제거하기 위해 의도적으로 이 모듈에 별도 보유한다.

const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'

export interface SimulatorRunScenarioItem {
  scenarioId: string
  name: string
  version: number
  commInterface: string
  supportedModes: string[]
}

export interface SimulatorRunTarget {
  eqpId: string
  state: string
  // 설비 통신타입(SOCKET / SECS / PLC) — tc_eqp.comm_interface 실값. 진행 테이블 '통신' 컬럼 표시용.
  commInterface: string
  completedCycleCount: number
  erroredCycleCount: number
  issuedLotRunIds: string[]
}

export interface SimulatorRunResponse {
  runId: string
  mode: string
  state: string
  targets: SimulatorRunTarget[]
}

export interface SimulatorRunCreateRequest {
  testType: LiveMapDemoTestType
  scenarioId: string
  eqpIds: string[]
}

const defaultErrorMessage = () => i18n.t('error.livemap.demoDefault')

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
  await apiClient.get('/auth/csrf', { withCredentials: true })

  const csrfToken = getCookieValue(CSRF_COOKIE_NAME)
  if (!csrfToken) {
    throw new Error(i18n.t('error.livemap.csrf'))
  }

  return csrfToken
}

const resolveSuccessPayload = <TData>(payload: unknown, fallbackMessage: string): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true || payload.data === null) {
    const apiPayload = isApiResponse(payload) ? payload : null
    throw new Error(apiPayload?.errorMsg || fallbackMessage)
  }

  return payload.data
}

const normalizeError = (error: unknown, fallbackMessage: string): Error => {
  // axios 에러도 Error 인스턴스라 instanceof 를 먼저 검사하면 백엔드 errorMsg("설비가 이미 다른 Run 에 점유...")를
  // 버리고 "Request failed with status code 409" 원문을 노출한다 — isAxiosError 를 먼저 본다.
  if (isAxiosError(error)) {
    const payload = error.response?.data
    if (isApiResponse(payload) && payload.success === false) {
      return new Error(payload.errorMsg || fallbackMessage)
    }
    return new Error(fallbackMessage)
  }

  if (error instanceof Error) {
    return error
  }

  return new Error(fallbackMessage)
}

export const liveMapDemoRunApi = {
  async getScenarios(mode?: string): Promise<SimulatorRunScenarioItem[]> {
    try {
      const response = await apiClient.get<ApiResponse<SimulatorRunScenarioItem[]>>(
        '/live-map/demo-runs/scenarios',
        {
          params: mode ? { mode } : undefined,
          withCredentials: true,
        },
      )
      return resolveSuccessPayload<SimulatorRunScenarioItem[]>(
        response.data,
        i18n.t('error.livemap.demoScenarios'),
      )
    } catch (error) {
      throw normalizeError(error, i18n.t('error.livemap.demoScenarios'))
    }
  },

  async createRun(request: SimulatorRunCreateRequest): Promise<SimulatorRunResponse> {
    try {
      const csrfToken = await issueCsrfToken()
      const response = await apiClient.post<ApiResponse<SimulatorRunResponse>>(
        '/live-map/demo-runs',
        request,
        {
          withCredentials: true,
          headers: { [CSRF_HEADER_NAME]: csrfToken },
        },
      )
      return resolveSuccessPayload<SimulatorRunResponse>(
        response.data,
        i18n.t('error.livemap.demoStart'),
      )
    } catch (error) {
      throw normalizeError(error, i18n.t('error.livemap.demoStart'))
    }
  },

  async getRun(runId: string): Promise<SimulatorRunResponse> {
    try {
      const response = await apiClient.get<ApiResponse<SimulatorRunResponse>>(
        `/live-map/demo-runs/${encodeURIComponent(runId)}`,
        { withCredentials: true },
      )
      return resolveSuccessPayload<SimulatorRunResponse>(response.data, defaultErrorMessage())
    } catch (error) {
      throw normalizeError(error, defaultErrorMessage())
    }
  },

  async stopRun(runId: string): Promise<SimulatorRunResponse> {
    try {
      const csrfToken = await issueCsrfToken()
      const response = await apiClient.post<ApiResponse<SimulatorRunResponse>>(
        `/live-map/demo-runs/${encodeURIComponent(runId)}/stop`,
        null,
        {
          withCredentials: true,
          headers: { [CSRF_HEADER_NAME]: csrfToken },
        },
      )
      return resolveSuccessPayload<SimulatorRunResponse>(
        response.data,
        i18n.t('error.livemap.demoStop'),
      )
    } catch (error) {
      throw normalizeError(error, i18n.t('error.livemap.demoStop'))
    }
  },

  // 설비-단위 종료 — Run 안의 한 설비만 중단(다른 설비는 계속). 진행 테이블 행별 종료 버튼에서 호출.
  async stopTarget(runId: string, eqpId: string): Promise<SimulatorRunResponse> {
    try {
      const csrfToken = await issueCsrfToken()
      const response = await apiClient.post<ApiResponse<SimulatorRunResponse>>(
        `/live-map/demo-runs/${encodeURIComponent(runId)}/targets/${encodeURIComponent(eqpId)}/stop`,
        null,
        {
          withCredentials: true,
          headers: { [CSRF_HEADER_NAME]: csrfToken },
        },
      )
      return resolveSuccessPayload<SimulatorRunResponse>(
        response.data,
        i18n.t('error.livemap.demoStop'),
      )
    } catch (error) {
      throw normalizeError(error, i18n.t('error.livemap.demoStop'))
    }
  },
}
