import type { ApiResponse } from '@/shared/types/api.types'
import { apiClient } from '@/shared/lib/api-client'
import { normalizeApiError, resolveSuccessPayload } from '@/shared/lib/api-error'

/**
 * GET /api/line 응답 1행. 백엔드 LineResponse 와 동일 형태입니다.
 */
export interface LineResponse {
  lineKey: number
  lineCode: string
  lineName: string
}

type LineListApiResponse = ApiResponse<LineResponse[]>

const failMessage = 'line list request failed'

export const lineApi = {
  /**
   * 활성 라인 목록을 조회합니다. (line_code 오름차순 — 서버 정렬)
   */
  getLineList: async (): Promise<LineResponse[]> => {
    try {
      const response = await apiClient.get<LineListApiResponse>('/line', {
        withCredentials: true,
      })
      return resolveSuccessPayload<LineResponse[]>(response.data, response.status, failMessage)
    } catch (error) {
      throw normalizeApiError(error, failMessage)
    }
  },
}
