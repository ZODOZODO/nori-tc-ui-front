import { isAxiosError } from 'axios'
import type { ApiResponse } from '@/features/auth/types/auth.types'
import { apiClient } from '@/shared/lib/api-client'

/**
 * GET /api/line 응답 1행. 백엔드 LineResponse 와 동일 형태입니다.
 */
export interface LineResponse {
  lineKey: number
  lineCode: string
  lineName: string
}

type LineListApiResponse = ApiResponse<LineResponse[]>

const resolveSuccessPayload = <TData>(payload: ApiResponse<TData>): TData => {
  if (!payload.success || payload.data === null) {
    throw new Error(payload.errorMsg || 'line list request failed')
  }
  return payload.data
}

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error
  }
  if (isAxiosError(error)) {
    const errorMessage =
      typeof error.response?.data?.errorMsg === 'string'
        ? error.response.data.errorMsg
        : 'line list request failed'
    return new Error(errorMessage)
  }
  return new Error('line list request failed')
}

export const lineApi = {
  /**
   * 활성 라인 목록을 조회합니다. (line_code 오름차순 — 서버 정렬)
   */
  getLineList: async (): Promise<LineResponse[]> => {
    try {
      const response = await apiClient.get<LineListApiResponse>('/line', {
        withCredentials: true,
      })
      return resolveSuccessPayload(response.data)
    } catch (error) {
      throw normalizeError(error)
    }
  },
}
