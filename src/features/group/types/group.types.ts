import i18n from '@/i18n'
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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * ApiResponse 런타임 구조 검사기입니다.
 */
export const isApiResponse = <TData = unknown>(value: unknown): value is ApiResponse<TData> => {
  if (!isRecord(value)) {
    return false
  }

  const hasSuccess = typeof value.success === 'boolean'
  const hasData = 'data' in value
  const hasErrorCode = value.errorCode === null || typeof value.errorCode === 'string'
  const hasErrorMsg = value.errorMsg === null || typeof value.errorMsg === 'string'

  return hasSuccess && hasData && hasErrorCode && hasErrorMsg
}

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

/**
 * Group API 레이어 전용 에러 객체입니다.
 */
export class GroupApiError extends Error {
  public readonly payload: GroupFailResponse
  public readonly status?: number

  constructor(payload: GroupFailResponse, status?: number) {
    super(payload.errorMsg)
    this.name = 'GroupApiError'
    this.payload = payload
    this.status = status
  }
}
