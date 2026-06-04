import { isAxiosError } from 'axios'
import type { ApiResponse } from '@/features/auth/types/auth.types'
import { apiClient } from '@/shared/lib/api-client'
import type {
  CanvasJson,
  LiveMapObjectKind,
  ShapeJson,
  TransformJson,
} from '../lib/live-map-layout.model'

export interface LiveMapObjectResponse {
  objectKey: number
  objectName: string
  objectKind: LiveMapObjectKind
  shapeJson: ShapeJson
  isActive: boolean
}

export interface LiveMapPlacementResponse {
  placementKey: number
  objectKey: number
  eqpKey: number | null
  transformJson: TransformJson
}

export interface LiveMapLayoutResponse {
  layoutKey: number | null
  lineKey: number
  canvasJson: CanvasJson | null
  placements: LiveMapPlacementResponse[]
  objects: LiveMapObjectResponse[]
}

export interface LiveMapPlacementInput {
  objectKey: number
  eqpKey: number | null
  transformJson: TransformJson
}

export interface LiveMapLayoutPutBody {
  canvasJson: CanvasJson | null
  placements: LiveMapPlacementInput[]
}

export interface LiveMapObjectSaveBody {
  objectName: string
  objectKind: LiveMapObjectKind
  shapeJson: ShapeJson
}

const failMessage = 'live-map layout request failed'

const resolveSuccessPayload = <TData>(payload: ApiResponse<TData>): TData => {
  if (!payload.success || payload.data === null) {
    throw new Error(payload.errorMsg || failMessage)
  }
  return payload.data
}

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error
  }
  if (isAxiosError(error)) {
    const errorMessage =
      typeof error.response?.data?.errorMsg === 'string' ? error.response.data.errorMsg : failMessage
    return new Error(errorMessage)
  }
  return new Error(failMessage)
}

export const layoutApi = {
  getLayout: async (lineKey: number): Promise<LiveMapLayoutResponse> => {
    try {
      const response = await apiClient.get<ApiResponse<LiveMapLayoutResponse>>('/live-map/layout', {
        params: { lineKey },
        withCredentials: true,
      })
      return resolveSuccessPayload(response.data)
    } catch (error) {
      throw normalizeError(error)
    }
  },

  putLayout: async (lineKey: number, body: LiveMapLayoutPutBody): Promise<LiveMapLayoutResponse> => {
    try {
      const response = await apiClient.put<ApiResponse<LiveMapLayoutResponse>>('/live-map/layout', body, {
        params: { lineKey },
        withCredentials: true,
      })
      return resolveSuccessPayload(response.data)
    } catch (error) {
      throw normalizeError(error)
    }
  },

  listObjects: async (): Promise<LiveMapObjectResponse[]> => {
    try {
      const response = await apiClient.get<ApiResponse<LiveMapObjectResponse[]>>(
        '/live-map/layout/objects',
        { withCredentials: true },
      )
      return resolveSuccessPayload(response.data)
    } catch (error) {
      throw normalizeError(error)
    }
  },

  createObject: async (body: LiveMapObjectSaveBody): Promise<LiveMapObjectResponse> => {
    try {
      const response = await apiClient.post<ApiResponse<LiveMapObjectResponse>>(
        '/live-map/layout/objects',
        body,
        { withCredentials: true },
      )
      return resolveSuccessPayload(response.data)
    } catch (error) {
      throw normalizeError(error)
    }
  },

  updateObject: async (objectKey: number, body: LiveMapObjectSaveBody): Promise<LiveMapObjectResponse> => {
    try {
      const response = await apiClient.put<ApiResponse<LiveMapObjectResponse>>(
        `/live-map/layout/objects/${objectKey}`,
        body,
        { withCredentials: true },
      )
      return resolveSuccessPayload(response.data)
    } catch (error) {
      throw normalizeError(error)
    }
  },

  deleteObject: async (objectKey: number): Promise<void> => {
    try {
      await apiClient.delete<ApiResponse<null>>(`/live-map/layout/objects/${objectKey}`, {
        withCredentials: true,
      })
    } catch (error) {
      throw normalizeError(error)
    }
  },
}
