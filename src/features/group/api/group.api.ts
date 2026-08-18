import i18n from '@/i18n'
import { apiClient } from '@/shared/lib/api-client'
import { ApiError, assertSuccessResponse, normalizeApiError, resolveSuccessPayload } from '@/shared/lib/api-error'
import { CSRF_HEADER_NAME, withCsrfHeaders } from '@/shared/lib/csrf'
import {
  createGroupFailResponse,
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
  type GroupPermissionMapping,
  type GroupPermissionMappingResponse,
  type GroupPermissionPage,
  type GroupPermissionPageResponse,
  type GroupUpdateResponse,
  type GroupUpsertRequest,
  type PermissionInfo,
  type PermissionPage,
  type PermissionPageResponse,
} from '../types/group.types'
import { isRecord } from '@/shared/types/api.types'

// 모듈 로드 시점이 아닌 호출 시점에 평가해 현재 UI 언어를 따르도록 getter 로 둔다.
const groupListFallbackMessage = () => i18n.t('error.group.list')
const groupMemberListFallbackMessage = () => i18n.t('error.group.memberList')

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
    throw new ApiError(
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
    throw new ApiError(
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

const permissionCatalogFallbackMessage = () => i18n.t('error.group.permissionCatalog')
const groupPermissionListFallbackMessage = () => i18n.t('error.group.permissionList')

const isPermissionInfoItem = (value: unknown): value is PermissionInfo =>
  isRecord(value) &&
  typeof value.permId === 'number' &&
  typeof value.permCode === 'string' &&
  typeof value.permName === 'string'

const isGroupPermissionMappingItem = (value: unknown): value is GroupPermissionMapping =>
  isRecord(value) &&
  typeof value.ugpKey === 'number' &&
  typeof value.groupId === 'number' &&
  typeof value.permId === 'number'

/**
 * PagedResponse 또는 bare array 응답을 {items, offset, limit, count} 로 정규화합니다.
 * 권한 카탈로그 / 그룹-권한 매핑 두 신규 엔드포인트가 공유합니다.
 */
const normalizePagedPayload = <TItem>(
  payload: unknown,
  isItem: (value: unknown) => value is TItem,
  requestedOffset: number,
  requestedLimit: number,
  fallbackMessage: string,
): { items: TItem[]; offset: number; limit: number; count: number } => {
  const itemsSource = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.items)
      ? payload.items
      : null

  if (itemsSource === null) {
    throw new ApiError(
      createGroupFailResponse(
        {
          success: false,
          data: null,
          errorCode: 'INVALID_RESPONSE',
          errorMsg: fallbackMessage,
        },
        fallbackMessage,
      ),
    )
  }

  const items = itemsSource.filter(isItem)
  const record = isRecord(payload) ? payload : {}
  const offset = typeof record.offset === 'number' ? record.offset : requestedOffset
  const limit = typeof record.limit === 'number' ? record.limit : requestedLimit
  const count =
    typeof record.count === 'number' ? Math.max(record.count, items.length) : items.length

  return { items, offset, limit, count }
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
      throw normalizeApiError(error, groupListFallbackMessage())
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
      throw normalizeApiError(error, i18n.t('error.group.detail'))
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
      throw normalizeApiError(error, i18n.t('error.group.create'))
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
      throw normalizeApiError(error, i18n.t('error.group.save'))
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

      assertSuccessResponse(
        response.data,
        response.status,
        i18n.t('error.group.delete'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.group.delete'))
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
      throw normalizeApiError(error, groupMemberListFallbackMessage())
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

      assertSuccessResponse(
        response.data,
        response.status,
        i18n.t('error.group.addMember'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.group.addMember'))
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

      assertSuccessResponse(
        response.data,
        response.status,
        i18n.t('error.group.removeMember'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.group.removeMember'))
    }
  },

  listAllPermissions: async (offset = 0, limit = 500): Promise<PermissionPage> => {
    try {
      const response = await apiClient.get<PermissionPageResponse>('/permission', {
        params: { offset, limit },
        withCredentials: true,
      })

      return normalizePagedPayload<PermissionInfo>(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          permissionCatalogFallbackMessage(),
        ),
        isPermissionInfoItem,
        offset,
        limit,
        permissionCatalogFallbackMessage(),
      )
    } catch (error) {
      throw normalizeApiError(error, permissionCatalogFallbackMessage())
    }
  },

  listGroupPermissions: async (
    groupId: number,
    offset = 0,
    limit = 500,
  ): Promise<GroupPermissionPage> => {
    try {
      const response = await apiClient.get<GroupPermissionPageResponse>(
        `/group/${groupId}/permission`,
        {
          params: { offset, limit },
          withCredentials: true,
        },
      )

      return normalizePagedPayload<GroupPermissionMapping>(
        resolveSuccessPayload<unknown>(
          response.data,
          response.status,
          groupPermissionListFallbackMessage(),
        ),
        isGroupPermissionMappingItem,
        offset,
        limit,
        groupPermissionListFallbackMessage(),
      )
    } catch (error) {
      throw normalizeApiError(error, groupPermissionListFallbackMessage())
    }
  },

  addGroupPermission: async (groupId: number, permId: number): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.post<GroupPermissionMappingResponse>(
          `/group/${groupId}/permission/${permId}`,
          null,
          {
            withCredentials: true,
            headers: { [CSRF_HEADER_NAME]: csrfToken },
            validateStatus: (status) => status >= 200 && status < 600,
          },
        ),
      )

      resolveSuccessPayload<GroupPermissionMapping>(
        response.data,
        response.status,
        i18n.t('error.group.addPermission'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.group.addPermission'))
    }
  },

  removeGroupPermission: async (groupId: number, permId: number): Promise<void> => {
    try {
      const response = await withCsrfHeaders((csrfToken) =>
        apiClient.delete<GroupDeleteResponse>(`/group/${groupId}/permission/${permId}`, {
          withCredentials: true,
          headers: { [CSRF_HEADER_NAME]: csrfToken },
          validateStatus: (status) => status >= 200 && status < 600,
        }),
      )

      assertSuccessResponse(
        response.data,
        response.status,
        i18n.t('error.group.removePermission'),
      )
    } catch (error) {
      throw normalizeApiError(error, i18n.t('error.group.removePermission'))
    }
  },
}
