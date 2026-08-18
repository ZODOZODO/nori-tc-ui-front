import type { ApiResponse } from '@/shared/types/api.types'
import { apiClient } from '@/shared/lib/api-client'
import { normalizeApiError, resolveSuccessPayload } from '@/shared/lib/api-error'
import { CSRF_HEADER_NAME, issueCsrfToken } from '@/shared/lib/csrf'
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

export const layoutApi = {
  getLayout: async (lineKey: number): Promise<LiveMapLayoutResponse> => {
    try {
      const response = await apiClient.get<ApiResponse<LiveMapLayoutResponse>>('/live-map/layout', {
        params: { lineKey },
        withCredentials: true,
      })
      return resolveSuccessPayload(response.data, response.status, failMessage)
    } catch (error) {
      throw normalizeApiError(error, failMessage)
    }
  },

  putLayout: async (lineKey: number, body: LiveMapLayoutPutBody): Promise<LiveMapLayoutResponse> => {
    try {
      const csrfToken = await issueCsrfToken()
      const response = await apiClient.put<ApiResponse<LiveMapLayoutResponse>>('/live-map/layout', body, {
        params: { lineKey },
        withCredentials: true,
        headers: { [CSRF_HEADER_NAME]: csrfToken },
      })
      return resolveSuccessPayload(response.data, response.status, failMessage)
    } catch (error) {
      throw normalizeApiError(error, failMessage)
    }
  },

  listObjects: async (): Promise<LiveMapObjectResponse[]> => {
    try {
      const response = await apiClient.get<ApiResponse<LiveMapObjectResponse[]>>(
        '/live-map/layout/objects',
        { withCredentials: true },
      )
      return resolveSuccessPayload(response.data, response.status, failMessage)
    } catch (error) {
      throw normalizeApiError(error, failMessage)
    }
  },

  createObject: async (body: LiveMapObjectSaveBody): Promise<LiveMapObjectResponse> => {
    try {
      const csrfToken = await issueCsrfToken()
      const response = await apiClient.post<ApiResponse<LiveMapObjectResponse>>(
        '/live-map/layout/objects',
        body,
        { withCredentials: true, headers: { [CSRF_HEADER_NAME]: csrfToken } },
      )
      return resolveSuccessPayload(response.data, response.status, failMessage)
    } catch (error) {
      throw normalizeApiError(error, failMessage)
    }
  },

  updateObject: async (objectKey: number, body: LiveMapObjectSaveBody): Promise<LiveMapObjectResponse> => {
    try {
      const csrfToken = await issueCsrfToken()
      const response = await apiClient.put<ApiResponse<LiveMapObjectResponse>>(
        `/live-map/layout/objects/${objectKey}`,
        body,
        { withCredentials: true, headers: { [CSRF_HEADER_NAME]: csrfToken } },
      )
      return resolveSuccessPayload(response.data, response.status, failMessage)
    } catch (error) {
      throw normalizeApiError(error, failMessage)
    }
  },

  deleteObject: async (objectKey: number): Promise<void> => {
    try {
      const csrfToken = await issueCsrfToken()
      await apiClient.delete<ApiResponse<null>>(`/live-map/layout/objects/${objectKey}`, {
        withCredentials: true,
        headers: { [CSRF_HEADER_NAME]: csrfToken },
      })
    } catch (error) {
      throw normalizeApiError(error, failMessage)
    }
  },
}
