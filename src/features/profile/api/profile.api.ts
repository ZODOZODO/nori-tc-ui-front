import i18n from '@/i18n'
import { apiClient } from '@/shared/lib/api-client'
import { normalizeApiError, resolveSuccessPayload } from '@/shared/lib/api-error'
import {
  type MeInfo,
  type MeResponse,
} from '../types/profile.types'

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
      throw normalizeApiError(error, i18n.t('error.profile.me'))
    }
  },
}
