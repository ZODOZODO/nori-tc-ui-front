import { isAxiosError } from 'axios'
import i18n from '@/i18n'
import type { ApiResponse } from '@/features/auth/types/auth.types'
import { apiClient } from '@/shared/lib/api-client'

export interface LiveMapPortResponse {
  id: string
  label: string
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

const resolveSuccessPayload = <TData>(payload: ApiResponse<TData>): TData => {
  if (!payload.success || payload.data === null) {
    throw new Error(payload.errorMsg || liveMapErrorMessage())
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
        : liveMapErrorMessage()
    return new Error(errorMessage)
  }

  return new Error(liveMapErrorMessage())
}

export const liveMapApi = {
  getLiveMap: async (): Promise<LiveMapResponse> => {
    try {
      const response = await apiClient.get<LiveMapApiResponse>('/live-map', {
        withCredentials: true,
      })

      return resolveSuccessPayload(response.data)
    } catch (error) {
      throw normalizeError(error)
    }
  },
}
