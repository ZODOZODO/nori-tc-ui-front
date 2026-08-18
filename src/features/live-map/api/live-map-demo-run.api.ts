import i18n from '@/i18n'
import type { ApiResponse } from '@/shared/types/api.types'
import { apiClient } from '@/shared/lib/api-client'
import { normalizeApiError, resolveSuccessPayload } from '@/shared/lib/api-error'
import { CSRF_HEADER_NAME, issueCsrfToken } from '@/shared/lib/csrf'
import type { LiveMapDemoTestType } from '../types/live-map.types'

// simulator orchestrator Run 경로(R-1) API. 응답 형상은 run 1개 + targets[](progress%/stage 없음).
// 에러 정규화는 공통 `@/shared/lib/api-error`, CSRF 는 공통 `@/shared/lib/csrf` 를 쓴다.

export interface SimulatorRunScenarioItem {
  scenarioId: string
  name: string
  version: number
  commInterface: string
  supportedModes: string[]
  // 시드 시나리오 여부(R-8) — true 면 삭제 불가(SEED_PROTECTED). 기존 필드 무변경, append-only.
  isSeed: boolean
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
  // 이력/목록 표시용 append-only(R5). createdAt=ISO-8601 문자열(정렬·시작시각 표시), scenarioId=시나리오 그룹 표시 출처.
  createdAt: string
  scenarioId: string
}

export interface SimulatorRunCreateRequest {
  testType: LiveMapDemoTestType
  scenarioId: string
  eqpIds: string[]
}

const defaultErrorMessage = () => i18n.t('error.livemap.demoDefault')

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
        response.status,
        i18n.t('error.livemap.demoScenarios'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.livemap.demoScenarios'))
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
        response.status,
        i18n.t('error.livemap.demoStart'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.livemap.demoStart'))
    }
  },

  async getRun(runId: string): Promise<SimulatorRunResponse> {
    try {
      const response = await apiClient.get<ApiResponse<SimulatorRunResponse>>(
        `/live-map/demo-runs/${encodeURIComponent(runId)}`,
        { withCredentials: true },
      )
      return resolveSuccessPayload<SimulatorRunResponse>(
        response.data,
        response.status,
        defaultErrorMessage(),
      )
    } catch (error) {
      throw normalizeApiError(error, defaultErrorMessage())
    }
  },

  // run 이력 목록(DB 출처) — 과거·실행중 run 을 모두 조회(재부착 포함). 모달 열림 동안 폴링.
  async listRuns(): Promise<SimulatorRunResponse[]> {
    try {
      const response = await apiClient.get<ApiResponse<SimulatorRunResponse[]>>(
        '/live-map/demo-runs',
        { withCredentials: true },
      )
      return resolveSuccessPayload<SimulatorRunResponse[]>(
        response.data,
        response.status,
        defaultErrorMessage(),
      )
    } catch (error) {
      throw normalizeApiError(error, defaultErrorMessage())
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
        response.status,
        i18n.t('error.livemap.demoStop'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.livemap.demoStop'))
    }
  },

  // 시나리오 업로드(R-8) — .scenario.md 파일을 multipart 로 전송. 성공 시 생성된 카탈로그 항목 반환.
  async uploadScenario(file: File): Promise<SimulatorRunScenarioItem> {
    try {
      const csrfToken = await issueCsrfToken()
      const formData = new FormData()
      formData.append('file', file)
      const response = await apiClient.post<ApiResponse<SimulatorRunScenarioItem>>(
        '/live-map/demo-runs/scenarios',
        formData,
        {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
            // apiClient 기본 헤더의 'Content-Type: application/json' 을 벗겨야 axios 가 FormData 를 감지해
            // boundary 포함 multipart/form-data 를 자동 설정한다(안 벗기면 백엔드 consumes=multipart 가 415 로 거부).
            'Content-Type': undefined,
          },
        },
      )
      return resolveSuccessPayload<SimulatorRunScenarioItem>(
        response.data,
        response.status,
        i18n.t('error.livemap.scenarioUpload'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.livemap.scenarioUpload'))
    }
  },

  // 시나리오 삭제(R-8) — 시드(409)/미존재(404)는 백엔드가 차단. 권한 게이팅은 프론트가 1차(백엔드 closed-by-default 가 최종).
  async deleteScenario(scenarioId: string): Promise<void> {
    try {
      const csrfToken = await issueCsrfToken()
      await apiClient.delete(`/live-map/demo-runs/scenarios/${encodeURIComponent(scenarioId)}`, {
        withCredentials: true,
        headers: { [CSRF_HEADER_NAME]: csrfToken },
      })
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.livemap.scenarioDelete'))
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
        response.status,
        i18n.t('error.livemap.demoStop'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.livemap.demoStop'))
    }
  },
}
