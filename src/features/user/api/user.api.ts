import { isAxiosError } from 'axios'
import i18n from '@/i18n'
import { apiClient } from '@/shared/lib/api-client'
import { CSRF_HEADER_NAME, readCsrfCookieToken, requestCsrfCookie } from '@/shared/lib/csrf'
import {
  createUserFailResponse,
  defaultUserErrorMessage,
  isApiResponse,
  isRecord,
  UserApiError,
  type UserCreateRequest,
  type UserCreateResponse,
  type UserDeleteResponse,
  type UserGroupSummary,
  type UserInfo,
  type UserInfoResponse,
  type UserListItem,
  type UserPage,
  type UserPageResponse,
  type UserPasswordResetRequest,
  type UserPasswordResetResponse,
  type UserUpdateRequest,
  type UserUpdateResponse,
} from '../types/user.types'

// 모듈 로드 시점이 아닌 호출 시점에 평가해 현재 UI 언어를 따르도록 getter 로 둔다.
const userListFallbackMessage = () => i18n.t('error.user.list')

const issueCsrfToken = async (): Promise<string> => {
  await requestCsrfCookie()

  const csrfToken = readCsrfCookieToken()
  if (!csrfToken) {
    throw new UserApiError(
      createUserFailResponse({
        success: false,
        data: null,
        errorCode: 'CSRF_TOKEN_MISSING',
        errorMsg: i18n.t('error.user.csrf'),
      }),
    )
  }

  return csrfToken
}

const normalizeUserError = (
  error: unknown,
  fallbackMessage = defaultUserErrorMessage(),
): UserApiError => {
  if (error instanceof UserApiError) {
    return error
  }

  if (isAxiosError(error)) {
    return new UserApiError(
      createUserFailResponse(error.response?.data, fallbackMessage),
      error.response?.status,
    )
  }

  return new UserApiError(createUserFailResponse(error, fallbackMessage))
}

const resolveSuccessPayload = <TData>(
  payload: unknown,
  status: number,
  fallbackMessage: string,
  allowNullData = false,
): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true) {
    throw new UserApiError(createUserFailResponse(payload, fallbackMessage), status)
  }

  if (payload.data === null && !allowNullData) {
    throw new UserApiError(
      createUserFailResponse(
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

const isUserGroupSummaryItem = (value: unknown): value is UserGroupSummary =>
  isRecord(value) &&
  typeof value.groupId === 'number' &&
  typeof value.groupCode === 'string' &&
  typeof value.groupName === 'string'

const isUserListItem = (value: unknown): value is UserListItem =>
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
  typeof value.updatedBy === 'string' &&
  Array.isArray(value.groups) &&
  value.groups.every(isUserGroupSummaryItem)

const normalizeUserPagePayload = (
  payload: unknown,
  requestedOffset: number,
  requestedLimit: number,
): UserPage => {
  if (Array.isArray(payload)) {
    const normalizedItems = payload.filter(isUserListItem)

    return {
      items: normalizedItems,
      offset: requestedOffset,
      limit: requestedLimit,
      count: normalizedItems.length,
    }
  }

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new UserApiError(
      createUserFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: userListFallbackMessage(),
        },
        userListFallbackMessage(),
      ),
    )
  }

  const items = payload.items.filter(isUserListItem)
  const offset = typeof payload.offset === 'number' ? payload.offset : requestedOffset
  const limit = typeof payload.limit === 'number' ? payload.limit : requestedLimit
  const count =
    typeof payload.count === 'number' ? Math.max(payload.count, items.length) : items.length

  return { items, offset, limit, count }
}

const withCsrfHeaders = async <TResponse>(
  requestFn: (csrfToken: string) => Promise<TResponse>,
): Promise<TResponse> => {
  const csrfToken = await issueCsrfToken()
  return requestFn(csrfToken)
}

export const userApi = {
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
        i18n.t('error.user.detail'),
      )
    } catch (error) {
      throw normalizeUserError(error, i18n.t('error.user.detail'))
    }
  },

  /**
   * 사용자 목록을 페이지네이션으로 조회합니다.
   */
  getUserList: async (offset = 0, limit = 20): Promise<UserPage> => {
    try {
      const response = await apiClient.get<UserPageResponse>('/user', {
        params: { offset, limit },
        withCredentials: true,
      })

      return normalizeUserPagePayload(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          userListFallbackMessage(),
        ),
        offset,
        limit,
      )
    } catch (error) {
      throw normalizeUserError(error, userListFallbackMessage())
    }
  },

  /**
   * 멘션 자동완성 / 그룹 멤버 추가 모달 등에서 사용하는 전체 사용자 조회입니다.
   * profile 영역 전용 — User 페이지는 페이지네이션 명시 호출(getUserList)을 사용합니다.
   *
   * 응답 항목은 `UserListItem` (groups 포함) 이며, groups 가 필요 없는 사용처는
   * `UserInfo` 로 사용해도 안전합니다 (UserListItem extends UserInfo).
   */
  getAllUsers: async (): Promise<UserListItem[]> => {
    const usersById = new Map<number, UserListItem>()
    const firstPage = await userApi.getUserList(0, 500)
    let cursorOffset = 0

    firstPage.items.forEach((user) => {
      usersById.set(user.userPk, user)
    })

    cursorOffset += firstPage.limit
    while (cursorOffset < firstPage.count) {
      const nextPage = await userApi.getUserList(cursorOffset, 500)
      nextPage.items.forEach((user) => {
        usersById.set(user.userPk, user)
      })
      cursorOffset += nextPage.limit
    }

    return Array.from(usersById.values())
  },

  /**
   * 사용자를 신규 생성합니다. password 가 필수입니다.
   */
  createUser: async (request: UserCreateRequest): Promise<UserInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<UserCreateResponse>('/user', request, {
          withCredentials: true,
          headers: { [CSRF_HEADER_NAME]: csrfToken },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<UserInfo>(
        response.data,
        response.status,
        i18n.t('error.user.create'),
      )
    } catch (error) {
      throw normalizeUserError(error, i18n.t('error.user.create'))
    }
  },

  /**
   * 사용자 정보를 저장합니다.
   */
  updateUser: async (userPk: number, request: UserUpdateRequest): Promise<UserInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<UserUpdateResponse>(`/user/${userPk}`, request, {
          withCredentials: true,
          headers: { [CSRF_HEADER_NAME]: csrfToken },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<UserInfo>(
        response.data,
        response.status,
        i18n.t('error.user.save'),
      )
    } catch (error) {
      throw normalizeUserError(error, i18n.t('error.user.save'))
    }
  },

  /**
   * 사용자를 삭제합니다.
   */
  deleteUser: async (userPk: number): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<UserDeleteResponse>(`/user/${userPk}`, {
          withCredentials: true,
          headers: { [CSRF_HEADER_NAME]: csrfToken },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      resolveSuccessPayload<null>(
        response.data,
        response.status,
        i18n.t('error.user.delete'),
        true,
      )
    } catch (error) {
      throw normalizeUserError(error, i18n.t('error.user.delete'))
    }
  },

  /**
   * 사용자 비밀번호를 변경합니다.
   */
  resetPassword: async (userPk: number, request: UserPasswordResetRequest): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<UserPasswordResetResponse>(
          `/user/${userPk}/password/reset`,
          request,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      resolveSuccessPayload<null>(
        response.data,
        response.status,
        i18n.t('error.user.password'),
        true,
      )
    } catch (error) {
      throw normalizeUserError(error, i18n.t('error.user.password'))
    }
  },

}
