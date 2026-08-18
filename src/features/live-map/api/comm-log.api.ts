import i18n from '@/i18n'
import type { ApiResponse } from '@/features/auth/types/auth.types'
import { apiClient } from '@/shared/lib/api-client'
import { normalizeApiError, resolveSuccessPayload } from '@/shared/lib/api-error'

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

export const commLogApi = {
  getLogs: async (eqpId: string, type: 'eqp' | 'mes' | 'all' = 'all'): Promise<CommLogEntry[]> => {
    try {
      const response = await apiClient.get<CommLogApiResponse>(`/comm-logs/${eqpId}`, {
        params: { type },
        withCredentials: true,
      })
      return resolveSuccessPayload<CommLogEntry[]>(
        response.data,
        response.status,
        errorMessage(),
      )
    } catch (error) {
      throw normalizeApiError(error, errorMessage())
    }
  },
}
