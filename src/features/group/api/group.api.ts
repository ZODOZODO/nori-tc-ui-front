import { isAxiosError } from 'axios'
import { apiClient } from '@/shared/lib/api-client'
import {
  createGroupFailResponse,
  DEFAULT_GROUP_ERROR_MESSAGE,
  GroupApiError,
  isApiResponse,
  isRecord,
  type GroupCreateResponse,
  type GroupDeleteResponse,
  type GroupInfo,
  type GroupInfoResponse,
  type GroupMembershipResponse,
  type GroupPage,
  type GroupPageResponse,
  type GroupUpdateResponse,
  type GroupUpsertRequest,
} from '../types/group.types'

const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'
const GROUP_LIST_FALLBACK_MESSAGE = '그룹 목록을 조회하지 못했습니다.'

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

const issueCsrfToken = async (): Promise<string> => {
  await apiClient.get('/auth/csrf', { withCredentials: true })

  const csrfToken = getCookieValue(CSRF_COOKIE_NAME)
  if (!csrfToken) {
    throw new GroupApiError(
      createGroupFailResponse({
        success: false,
        data: null,
        errorCode: 'CSRF_TOKEN_MISSING',
        errorMsg: 'CSRF 토큰을 확인할 수 없습니다. 페이지를 새로고침한 후 다시 시도해 주세요.',
      }),
    )
  }

  return csrfToken
}

const normalizeGroupError = (
  error: unknown,
  fallbackMessage = DEFAULT_GROUP_ERROR_MESSAGE,
): GroupApiError => {
  if (error instanceof GroupApiError) {
    return error
  }

  if (isAxiosError(error)) {
    return new GroupApiError(
      createGroupFailResponse(error.response?.data, fallbackMessage),
      error.response?.status,
    )
  }

  return new GroupApiError(createGroupFailResponse(error, fallbackMessage))
}

const resolveSuccessPayload = <TData>(
  payload: unknown,
  status: number,
  fallbackMessage: string,
  allowNullData = false,
): TData => {
  if (!isApiResponse<TData>(payload) || payload.success !== true) {
    throw new GroupApiError(createGroupFailResponse(payload, fallbackMessage), status)
  }

  if (payload.data === null && !allowNullData) {
    throw new GroupApiError(
      createGroupFailResponse(
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

const isGroupInfoItem = (value: unknown): value is GroupInfo =>
  isRecord(value) &&
  typeof value.groupId === 'number' &&
  typeof value.groupCode === 'string' &&
  typeof value.groupName === 'string' &&
  typeof value.isActive === 'boolean' &&
  typeof value.createdAt === 'string' &&
  typeof value.updatedAt === 'string'

const normalizeGroupPagePayload = (
  payload: unknown,
  requestedOffset: number,
  requestedLimit: number,
): GroupPage => {
  if (Array.isArray(payload)) {
    const normalizedItems = payload.filter(isGroupInfoItem)
    return {
      items: normalizedItems,
      offset: requestedOffset,
      limit: requestedLimit,
      count: normalizedItems.length,
    }
  }

  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new GroupApiError(
      createGroupFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: GROUP_LIST_FALLBACK_MESSAGE,
        },
        GROUP_LIST_FALLBACK_MESSAGE,
      ),
    )
  }

  const items = payload.items.filter(isGroupInfoItem)
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

export const groupApi = {
  getGroupList: async (offset = 0, limit = 20): Promise<GroupPage> => {
    try {
      const response = await apiClient.get<GroupPageResponse>('/group', {
        params: { offset, limit },
        withCredentials: true,
      })

      return normalizeGroupPagePayload(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          GROUP_LIST_FALLBACK_MESSAGE,
        ),
        offset,
        limit,
      )
    } catch (error) {
      throw normalizeGroupError(error, GROUP_LIST_FALLBACK_MESSAGE)
    }
  },

  getGroupDetail: async (groupId: number): Promise<GroupInfo> => {
    try {
      const response = await apiClient.get<GroupInfoResponse>(`/group/${groupId}`, {
        withCredentials: true,
      })

      return resolveSuccessPayload<GroupInfo>(
        response.data,
        response.status,
        '그룹 상세 정보를 조회하지 못했습니다.',
      )
    } catch (error) {
      throw normalizeGroupError(error, '그룹 상세 정보를 조회하지 못했습니다.')
    }
  },

  createGroup: async (request: GroupUpsertRequest): Promise<GroupInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<GroupCreateResponse>('/group', request, {
          withCredentials: true,
          headers: { [CSRF_HEADER_NAME]: csrfToken },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<GroupInfo>(
        response.data,
        response.status,
        '그룹 생성에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeGroupError(error, '그룹 생성에 실패했습니다.')
    }
  },

  updateGroup: async (groupId: number, request: GroupUpsertRequest): Promise<GroupInfo> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.put<GroupUpdateResponse>(`/group/${groupId}`, request, {
          withCredentials: true,
          headers: { [CSRF_HEADER_NAME]: csrfToken },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      return resolveSuccessPayload<GroupInfo>(
        response.data,
        response.status,
        '그룹 정보 저장에 실패했습니다.',
      )
    } catch (error) {
      throw normalizeGroupError(error, '그룹 정보 저장에 실패했습니다.')
    }
  },

  deleteGroup: async (groupId: number): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<GroupDeleteResponse>(`/group/${groupId}`, {
          withCredentials: true,
          headers: { [CSRF_HEADER_NAME]: csrfToken },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      resolveSuccessPayload<null>(
        response.data,
        response.status,
        '그룹 삭제에 실패했습니다.',
        true,
      )
    } catch (error) {
      throw normalizeGroupError(error, '그룹 삭제에 실패했습니다.')
    }
  },

  addMember: async (userPk: number, groupId: number): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<GroupMembershipResponse>(
          `/user/${userPk}/group/${groupId}`,
          null,
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
        '그룹 멤버 추가에 실패했습니다.',
        true,
      )
    } catch (error) {
      throw normalizeGroupError(error, '그룹 멤버 추가에 실패했습니다.')
    }
  },

  removeMember: async (userPk: number, groupId: number): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<GroupMembershipResponse>(
          `/user/${userPk}/group/${groupId}`,
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
        '그룹 멤버 제거에 실패했습니다.',
        true,
      )
    } catch (error) {
      throw normalizeGroupError(error, '그룹 멤버 제거에 실패했습니다.')
    }
  },
}
