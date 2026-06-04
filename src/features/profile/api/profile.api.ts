import { isAxiosError } from 'axios'
import i18n from '@/i18n'
import { apiClient } from '@/shared/lib/api-client'
import {
  createProfileFailResponse,
  defaultProfileErrorMessage,
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
  fallbackMessage = defaultProfileErrorMessage(),
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
        i18n.t('error.profile.me'),
      )
    } catch (error) {
      throw normalizeProfileError(error, i18n.t('error.profile.me'))
    }
  },
}
