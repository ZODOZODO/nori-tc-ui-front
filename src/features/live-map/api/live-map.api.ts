import i18n from '@/i18n'
import type { ApiResponse } from '@/shared/types/api.types'
import { apiClient } from '@/shared/lib/api-client'
import { normalizeApiError, resolveSuccessPayload } from '@/shared/lib/api-error'

export interface LiveMapPortResponse {
  id: string
  label: string
  carrierId: string | null
  status: 'RUN' | 'IDLE' | 'DOWN'
  statusLabel: string
}

export interface LiveMapEquipmentResponse {
  eqpKey: number
  eqpId: string
  eqpName: string
  lineValue: string
  lineLabel: string
  clusterId: string
  clusterName: string
  equipmentModeLabel: string
  status: 'RUN' | 'IDLE' | 'ERROR' | 'DOWN'
  statusLabel: string
  portItems: LiveMapPortResponse[]
  tooltipMeta: string
  tooltipStep: string
  alertMessage: string | null
}

export interface LiveMapResponse {
  equipmentItems: LiveMapEquipmentResponse[]
}

type LiveMapApiResponse = ApiResponse<LiveMapResponse>

// 모듈 로드 시점이 아닌 호출 시점에 평가해 현재 UI 언어를 따르도록 getter 로 둔다.
const liveMapErrorMessage = () => i18n.t('livemap.error')

export const liveMapApi = {
  getLiveMap: async (): Promise<LiveMapResponse> => {
    try {
      const response = await apiClient.get<LiveMapApiResponse>('/live-map', {
        withCredentials: true,
      })

      return resolveSuccessPayload(response.data, response.status, liveMapErrorMessage())
    } catch (error) {
      throw normalizeApiError(error, liveMapErrorMessage())
    }
  },
}
