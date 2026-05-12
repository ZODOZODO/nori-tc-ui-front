import { isAxiosError } from 'axios'
import { apiClient } from '@/shared/lib/api-client'
import {
  createProfileFailResponse,
  DEFAULT_PROFILE_ERROR_MESSAGE,
  isApiResponse,
  ProfileApiError,
  type MeInfo,
  type MeResponse,
} from '../types/profile.types'

/**
 * 알 수 없는 예외를 ProfileApiError 로 변환합니다.
 */
const normalizeProfileError = (
  error: unknown,
  fallbackMessage = DEFAULT_PROFILE_ERROR_MESSAGE,
): ProfileApiError => {
  if (error instanceof ProfileApiError) {
    return error
  }

  if (isAxiosError(error)) {
    return new ProfileApiError(
      createProfileFailResponse(error.response?.data, fallbackMessage),
      error.response?.status,
    )
  }

  return new ProfileApiError(createProfileFailResponse(error, fallbackMessage))
}

const resolveSuccessPayload = <TData>(
  payload: unknown,
  status: number,
  fallbackMessage: string,
): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true) {
    throw new ProfileApiError(createProfileFailResponse(payload, fallbackMessage), status)
  }

  if (payload.data === null) {
    throw new ProfileApiError(
      createProfileFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: fallbackMessage,
        },
        fallbackMessage,
      ),
      status,
    )
  }

  return payload.data as TData
}

export const profileApi = {
  /**
   * 현재 인증 사용자 정보를 조회합니다.
   */
  getMe: async (): Promise<MeInfo> => {
    try {
      const response = await apiClient.get<MeResponse>('/auth/me', {
        withCredentials: true,
      })

      return resolveSuccessPayload<MeInfo>(
        response.data,
        response.status,
        '현재 사용자 정보를 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeProfileError(error, '현재 사용자 정보를 조회하지 못했습니다.')
    }
  },
}
