import { isAxiosError } from 'axios'
import type { ApiResponse } from '@/features/auth/types/auth.types'
import { apiClient } from '@/shared/lib/api-client'

export interface LiveMapPortResponse {
  id: string
  label: string
  status: 'RUN' | 'IDLE' | 'DOWN'
  statusLabel: string
}

export interface LiveMapEquipmentResponse {
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

const LIVE_MAP_ERROR_MESSAGE = '라이브 맵 정보를 조회하지 못했습니다.'

const resolveSuccessPayload = <TData>(payload: ApiResponse<TData>): TData => {
  if (!payload.success || payload.data === null) {
    throw new Error(payload.errorMsg || LIVE_MAP_ERROR_MESSAGE)
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
        : LIVE_MAP_ERROR_MESSAGE
    return new Error(errorMessage)
  }

  return new Error(LIVE_MAP_ERROR_MESSAGE)
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
