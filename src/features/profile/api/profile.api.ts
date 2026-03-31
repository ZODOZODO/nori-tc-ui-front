import { isAxiosError } from 'axios'
import { apiClient } from '@/shared/lib/api-client'
import {
  createProfileFailResponse,
  DEFAULT_PROFILE_ERROR_MESSAGE,
  isApiResponse,
  isRecord,
  ProfileApiError,
  type MeInfo,
  type MeResponse,
  type UserInfo,
  type UserInfoResponse,
  type UserPage,
  type UserPageResponse,
  type UserPasswordResetRequest,
  type UserPasswordResetResponse,
  type UserUpdateRequest,
  type UserUpdateResponse,
} from '../types/profile.types'

const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'
const USER_LIST_FALLBACK_MESSAGE = '사용자 목록을 조회하지 못했습니다.'

/**
 * document.cookie에서 특정 쿠키 값을 추출합니다.
 */
const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined' || !document.cookie) {
    return null
  }

  const encodedName = `${encodeURIComponent(name)}=`
  const matchedCookie = document.cookie
    .split('; ')
    .find((cookieEntry) => cookieEntry.startsWith(encodedName))

  if (!matchedCookie) {
    return null
  }

  return decodeURIComponent(matchedCookie.substring(encodedName.length))
}

/**
 * 상태 변경 요청 이전에 CSRF 토큰을 확보합니다.
 */
const issueCsrfToken = async (): Promise<string> => {
  await apiClient.get('/auth/csrf', {
    withCredentials: true,
  })

  const csrfToken = getCookieValue(CSRF_COOKIE_NAME)
  if (!csrfToken) {
    throw new ProfileApiError(
      createProfileFailResponse({
        success: false,
        data: null,
        errorCode: 'CSRF_TOKEN_MISSING',
        errorMsg: 'CSRF 토큰을 확인할 수 없습니다. 페이지를 새로고침한 후 다시 시도해 주세요.',
      }),
    )
  }

  return csrfToken
}

/**
 * 알 수 없는 예외를 ProfileApiError로 변환합니다.
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

/**
 * success=true + data payload 구조를 검증합니다.
 */
const resolveSuccessPayload = <TData>(
  payload: unknown,
  status: number,
  fallbackMessage: string,
  allowNullData = false,
): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true) {
    throw new ProfileApiError(createProfileFailResponse(payload, fallbackMessage), status)
  }

  if (payload.data === null && !allowNullData) {
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

const isUserInfoItem = (value: unknown): value is UserInfo =>
  isRecord(value) &&
  typeof value.userPk === 'number' &&
  typeof value.userId === 'string' &&
  typeof value.userIdNorm === 'string' &&
  typeof value.userName === 'string' &&
  typeof value.company === 'string' &&
  typeof value.department === 'string' &&
  typeof value.email === 'string' &&
  typeof value.status === 'string' &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string' &&
  typeof value.createdBy === 'string' &&
  typeof value.updatedBy === 'string'

const normalizeUserPagePayload = (
  payload: unknown,
  requestedOffset: number,
  requestedLimit: number,
): UserPage => {
  if (Array.isArray(payload)) {
    const normalizedItems = payload.filter(isUserInfoItem)

    return {
      items: normalizedItems,
      offset: requestedOffset,
      limit: requestedLimit,
      count: normalizedItems.length,
    }
  }

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new ProfileApiError(
      createProfileFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: USER_LIST_FALLBACK_MESSAGE,
        },
        USER_LIST_FALLBACK_MESSAGE,
      ),
    )
  }

  const items = payload.items.filter(isUserInfoItem)
  const offset = typeof payload.offset === 'number' ? payload.offset : requestedOffset
  const limit = typeof payload.limit === 'number' ? payload.limit : requestedLimit
  const count = typeof payload.count === 'number' ? Math.max(payload.count, items.length) : items.length

  return {
    items,
    offset,
    limit,
    count,
  }
}

/**
 * CSRF 헤더가 필요한 요청을 공통 처리합니다.
 */
const withCsrfHeaders = async <TResponse>(
  requestFn: (csrfToken: string) => Promise<TResponse>,
): Promise<TResponse> => {
  const csrfToken = await issueCsrfToken()
  return requestFn(csrfToken)
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

  /**
   * 사용자 상세 정보를 조회합니다.
   */
  getUserDetail: async (userPk: number): Promise<UserInfo> => {
    try {
      const response = await apiClient.get<UserInfoResponse>(`/user/${userPk}`, {
        withCredentials: true,
      })

      return resolveSuccessPayload<UserInfo>(
        response.data,
        response.status,
        '사용자 상세 정보를 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeProfileError(error, '사용자 상세 정보를 조회하지 못했습니다.')
    }
  },

  getUserList: async (offset = 0, limit = 500): Promise<UserPage> => {
    try {
      const response = await apiClient.get<UserPageResponse>('/user', {
        params: { offset, limit },
        withCredentials: true,
      })

      return normalizeUserPagePayload(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          USER_LIST_FALLBACK_MESSAGE,
        ),
        offset,
        limit,
      )
    } catch (error) {
      throw normalizeProfileError(error, USER_LIST_FALLBACK_MESSAGE)
    }
  },

  getAllUsers: async (): Promise<UserInfo[]> => {
    const allUsers: UserInfo[] = []
    const usersById = new Map<number, UserInfo>()
    const firstPage = await profileApi.getUserList(0, 500)
    let cursorOffset = 0

    firstPage.items.forEach((user) => {
      usersById.set(user.userPk, user)
    })

    cursorOffset += firstPage.limit
    while (cursorOffset < firstPage.count) {
      const nextPage = await profileApi.getUserList(cursorOffset, 500)
      nextPage.items.forEach((user) => {
        usersById.set(user.userPk, user)
      })
      cursorOffset += nextPage.limit
    }

    allUsers.push(...usersById.values())

    return allUsers
  },

  /**
   * 사용자 정보를 저장합니다.
   */
  updateUser: async (userPk: number, request: UserUpdateRequest): Promise<UserInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<UserUpdateResponse>(`/user/${userPk}`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<UserInfo>(
        response.data,
        response.status,
        '사용자 정보 저장에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeProfileError(error, '사용자 정보 저장에 실패했습니다.')
    }
  },

  /**
   * 사용자 비밀번호를 변경합니다.
   */
  resetPassword: async (userPk: number, request: UserPasswordResetRequest): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<UserPasswordResetResponse>(`/user/${userPk}/password/reset`, request, {
          withCredentials: true,
          headers: {
            [CSRF_HEADER_NAME]: csrfToken,
          },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      resolveSuccessPayload<null>(response.data, response.status, '비밀번호 변경에 실패했습니다.', true)
    } catch (error) {
      throw normalizeProfileError(error, '비밀번호 변경에 실패했습니다.')
    }
  },
}
