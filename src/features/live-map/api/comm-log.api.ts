import { isAxiosError } from 'axios'
import i18n from '@/i18n'
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

// 모듈 로드 시점이 아닌 호출 시점에 평가해 현재 UI 언어를 따르도록 getter 로 둔다.
const errorMessage = () => i18n.t('livemap.commlog.error')

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) return error
  if (isAxiosError(error)) {
    const msg = error.response?.data?.errorMsg
    return new Error(typeof msg === 'string' ? msg : errorMessage())
  }
  return new Error(errorMessage())
}

export const commLogApi = {
  getLogs: async (eqpId: string, type: 'eqp' | 'mes' | 'all' = 'all'): Promise<CommLogEntry[]> => {
    try {
      const response = await apiClient.get<CommLogApiResponse>(`/comm-logs/${eqpId}`, {
        params: { type },
        withCredentials: true,
      })
      if (!response.data.success || response.data.data === null) {
        throw new Error(response.data.errorMsg || errorMessage())
      }
      return response.data.data
    } catch (error) {
      throw normalizeError(error)
    }
  },
}
