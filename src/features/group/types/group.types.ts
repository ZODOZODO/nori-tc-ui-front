import i18n from '@/i18n'
import { isApiResponse } from '@/shared/types/api.types'
import type { ApiResponse } from '@/features/auth/types/auth.types'

/**
 * GroupController GET /api/group/{groupId} 응답 payload 입니다.
 * ui-backend `GroupInfoResponse` 와 1:1 매칭됩니다.
 */
export interface GroupInfo {
  groupId: number
  groupCode: string
  groupName: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * GET /api/group 조회 응답 payload 타입입니다.
 */
export interface GroupPage {
  items: GroupInfo[]
  offset: number
  limit: number
  count: number
}

export type GroupPageResponse = ApiResponse<GroupPage>
export type GroupInfoResponse = ApiResponse<GroupInfo>
export type GroupCreateResponse = ApiResponse<GroupInfo>
export type GroupUpdateResponse = ApiResponse<GroupInfo>
export type GroupDeleteResponse = ApiResponse<null>
export type GroupMembershipResponse = ApiResponse<null>

/**
 * GET /api/group/{groupId}/user 응답 한 행 — ui-backend `GroupMemberResponse` 와 1:1.
 */
export interface GroupMember {
  userPk: number
  userId: string
  userName: string
  company: string
  department: string
}

/**
 * GET /api/group/{groupId}/user 응답 페이지 (PagedResponse<GroupMemberResponse>).
 */
export interface GroupMemberPage {
  items: GroupMember[]
  offset: number
  limit: number
  count: number
}

export type GroupMemberPageResponse = ApiResponse<GroupMemberPage>

/**
 * GET /api/permission 카탈로그 한 행 — ui-backend `PermissionInfoResponse` 와 1:1.
 * 프론트는 권한 부여/회수 UI 에 필요한 필드만 사용한다(나머지 필드는 무시).
 */
export interface PermissionInfo {
  permId: number
  permCode: string
  permName: string
  resourceType: 'API' | 'PAGE'
  resource: string | null
  httpMethod: string | null
  description: string | null
  isActive: boolean
}

/**
 * GET /api/permission 응답 페이지 (PagedResponse<PermissionInfoResponse>).
 */
export interface PermissionPage {
  items: PermissionInfo[]
  offset: number
  limit: number
  count: number
}

export type PermissionPageResponse = ApiResponse<PermissionPage>

/**
 * GET /api/group/{groupId}/permission 한 행 — ui-backend `GroupPermissionMappingResponse` 와 1:1.
 * permCode 가 아닌 permId 로 매핑되므로, 카탈로그(PermissionInfo)와 permId 로 교차한다.
 */
export interface GroupPermissionMapping {
  ugpKey: number
  groupId: number
  permId: number
  grantedAt: string
  grantedBy: string | null
}

/**
 * GET /api/group/{groupId}/permission 응답 페이지 (PagedResponse<GroupPermissionMappingResponse>).
 */
export interface GroupPermissionPage {
  items: GroupPermissionMapping[]
  offset: number
  limit: number
  count: number
}

export type GroupPermissionPageResponse = ApiResponse<GroupPermissionPage>
export type GroupPermissionMappingResponse = ApiResponse<GroupPermissionMapping>

/**
 * POST /api/group, PUT /api/group/{groupId} 요청 DTO 입니다.
 * 백엔드 `GroupUpsertRequest` 와 1:1 매칭됩니다.
 */
export interface GroupUpsertRequest {
  groupCode: string
  groupName: string
  description?: string | null
  isActive?: boolean | null
}

/**
 * Group API 계층 공통 실패 응답 타입입니다.
 */
export type GroupFailResponse = ApiResponse<null> & {
  success: false
  data: null
  errorCode: string
  errorMsg: string
}

/**
 * Group API 기본 오류 메시지입니다.
 * 모듈 로드 시점이 아닌 호출 시점에 평가해 현재 UI 언어를 따르도록 getter 로 둔다.
 */
export const defaultGroupErrorMessage = () => i18n.t('error.group.default')

/**
 * 실패 payload 를 GroupFailResponse 형태로 정규화합니다.
 */
export const createGroupFailResponse = (
  payload: unknown,
  fallbackMessage = defaultGroupErrorMessage(),
): GroupFailResponse => {
  if (isApiResponse(payload) && payload.success === false) {
    return {
      success: false,
      data: null,
      errorCode:
        typeof payload.errorCode === 'string' && payload.errorCode.length > 0
          ? payload.errorCode
          : 'UNKNOWN_ERROR',
      errorMsg:
        typeof payload.errorMsg === 'string' && payload.errorMsg.length > 0
          ? payload.errorMsg
          : fallbackMessage,
    }
  }

  return {
    success: false,
    data: null,
    errorCode: 'UNKNOWN_ERROR',
    errorMsg: fallbackMessage,
  }
}

