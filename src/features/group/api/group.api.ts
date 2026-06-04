import { isAxiosError } from 'axios'
import i18n from '@/i18n'
import { apiClient } from '@/shared/lib/api-client'
import {
  createGroupFailResponse,
  defaultGroupErrorMessage,
  GroupApiError,
  isApiResponse,
  isRecord,
  type GroupCreateResponse,
  type GroupDeleteResponse,
  type GroupInfo,
  type GroupInfoResponse,
  type GroupMember,
  type GroupMemberPage,
  type GroupMemberPageResponse,
  type GroupMembershipResponse,
  type GroupPage,
  type GroupPageResponse,
  type GroupUpdateResponse,
  type GroupUpsertRequest,
} from '../types/group.types'

const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'
// 모듈 로드 시점이 아닌 호출 시점에 평가해 현재 UI 언어를 따르도록 getter 로 둔다.
const groupListFallbackMessage = () => i18n.t('error.group.list')
const groupMemberListFallbackMessage = () => i18n.t('error.group.memberList')

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
        errorMsg: i18n.t('error.group.csrf'),
      }),
    )
  }

  return csrfToken
}

const normalizeGroupError = (
  error: unknown,
  fallbackMessage = defaultGroupErrorMessage(),
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

const isGroupMemberItem = (value: unknown): value is GroupMember =>
  isRecord(value) &&
  typeof value.userPk === 'number' &&
  typeof value.userId === 'string' &&
  typeof value.userName === 'string' &&
  typeof value.company === 'string' &&
  typeof value.department === 'string'

const normalizeGroupMemberPagePayload = (
  payload: unknown,
  requestedOffset: number,
  requestedLimit: number,
): GroupMemberPage => {
  if (Array.isArray(payload)) {
    const normalizedItems = payload.filter(isGroupMemberItem)
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
          errorMsg: groupMemberListFallbackMessage(),
        },
        groupMemberListFallbackMessage(),
      ),
    )
  }

  const items = payload.items.filter(isGroupMemberItem)
  const offset = typeof payload.offset === 'number' ? payload.offset : requestedOffset
  const limit = typeof payload.limit === 'number' ? payload.limit : requestedLimit
  const count =
    typeof payload.count === 'number' ? Math.max(payload.count, items.length) : items.length

  return { items, offset, limit, count }
}

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
          errorMsg: groupListFallbackMessage(),
        },
        groupListFallbackMessage(),
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
          groupListFallbackMessage(),
        ),
        offset,
        limit,
      )
    } catch (error) {
      throw normalizeGroupError(error, groupListFallbackMessage())
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
        i18n.t('error.group.detail'),
      )
    } catch (error) {
      throw normalizeGroupError(error, i18n.t('error.group.detail'))
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
        i18n.t('error.group.create'),
      )
    } catch (error) {
      throw normalizeGroupError(error, i18n.t('error.group.create'))
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
        i18n.t('error.group.save'),
      )
    } catch (error) {
      throw normalizeGroupError(error, i18n.t('error.group.save'))
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
        i18n.t('error.group.delete'),
        true,
      )
    } catch (error) {
      throw normalizeGroupError(error, i18n.t('error.group.delete'))
    }
  },

  listMembers: async (groupId: number, offset = 0, limit = 500): Promise<GroupMemberPage> => {
    try {
      const response = await apiClient.get<GroupMemberPageResponse>(`/group/${groupId}/user`, {
        params: { offset, limit },
        withCredentials: true,
      })

      return normalizeGroupMemberPagePayload(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          groupMemberListFallbackMessage(),
        ),
        offset,
        limit,
      )
    } catch (error) {
      throw normalizeGroupError(error, groupMemberListFallbackMessage())
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
        i18n.t('error.group.addMember'),
        true,
      )
    } catch (error) {
      throw normalizeGroupError(error, i18n.t('error.group.addMember'))
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
        i18n.t('error.group.removeMember'),
        true,
      )
    } catch (error) {
      throw normalizeGroupError(error, i18n.t('error.group.removeMember'))
    }
  },
}
