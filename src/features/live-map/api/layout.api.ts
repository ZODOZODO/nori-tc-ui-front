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

// CSRF — 백엔드(Spring Security)는 쓰기 요청에 X-XSRF-TOKEN 헤더를 요구한다(Double Submit Cookie).
// 다른 feature API(user/deploy/eqp/model…)와 동일하게 GET /auth/csrf 선호출 → 쿠키 토큰을 헤더로 수동 부착.
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'

const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }
  const encodedName = `${encodeURIComponent(name)}=`
  const matched = document.cookie.split('; ').find((entry) => entry.startsWith(encodedName))
  return matched ? decodeURIComponent(matched.substring(encodedName.length)) : null
}

const issueCsrfToken = async (): Promise<string> => {
  await apiClient.get('/auth/csrf', { withCredentials: true })
  const token = getCookieValue(CSRF_COOKIE_NAME)
  if (!token) {
    throw new Error('CSRF token missing')
  }
  return token
}

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
      const csrfToken = await issueCsrfToken()
      const response = await apiClient.put<ApiResponse<LiveMapLayoutResponse>>('/live-map/layout', body, {
        params: { lineKey },
        withCredentials: true,
        headers: { [CSRF_HEADER_NAME]: csrfToken },
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
      const csrfToken = await issueCsrfToken()
      const response = await apiClient.post<ApiResponse<LiveMapObjectResponse>>(
        '/live-map/layout/objects',
        body,
        { withCredentials: true, headers: { [CSRF_HEADER_NAME]: csrfToken } },
      )
      return resolveSuccessPayload(response.data)
    } catch (error) {
      throw normalizeError(error)
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
      return resolveSuccessPayload(response.data)
    } catch (error) {
      throw normalizeError(error)
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
      throw normalizeError(error)
    }
  },
}
