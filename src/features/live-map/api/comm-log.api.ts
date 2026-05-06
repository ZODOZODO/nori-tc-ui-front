import { isAxiosError } from 'axios'
import type { ApiResponse } from '@/features/auth/types/auth.types'
import { apiClient } from '@/shared/lib/api-client'

export interface CommLogEntry {
  eqpId: string
  timestampMs: number
  direction: 'RECV' | 'SEND'
  source: 'EQP' | 'MES'
  messageName: string | null
  payload: string | null
}

type CommLogApiResponse = ApiResponse<CommLogEntry[]>

const ERROR_MESSAGE = '통신 로그를 조회하지 못했습니다.'

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) return error
  if (isAxiosError(error)) {
    const msg = error.response?.data?.errorMsg
    return new Error(typeof msg === 'string' ? msg : ERROR_MESSAGE)
  }
  return new Error(ERROR_MESSAGE)
}

export const commLogApi = {
  getLogs: async (eqpId: string, type: 'eqp' | 'mes' | 'all' = 'all'): Promise<CommLogEntry[]> => {
    try {
      const response = await apiClient.get<CommLogApiResponse>(`/comm-logs/${eqpId}`, {
        params: { type },
        withCredentials: true,
      })
      if (!response.data.success || response.data.data === null) {
        throw new Error(response.data.errorMsg || ERROR_MESSAGE)
      }
      return response.data.data
    } catch (error) {
      throw normalizeError(error)
    }
  },
}
