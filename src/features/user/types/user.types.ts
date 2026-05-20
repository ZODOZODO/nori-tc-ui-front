import type { ApiResponse } from '@/features/auth/types/auth.types'

/**
 * UserController GET /api/user/{userPk} 응답 payload 타입입니다.
 * 단건 조회, POST, PUT 응답에서 사용합니다.
 */
export interface UserInfo {
  userPk: number
  company: string
  department: string
  userName: string
  userId: string
  userIdNorm: string
  email: string
  status: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

/**
 * 사용자 목록 행에 포함되는 그룹 요약 정보입니다. 백엔드 `UserListItemResponse.GroupSummary` 와 1:1.
 */
export interface UserGroupSummary {
  groupId: number
  groupCode: string
  groupName: string
}

/**
 * GET /api/user 응답의 단일 행 타입입니다. `UserInfo` 의 모든 필드에 `groups` 가 추가됩니다.
 * 단건/POST/PUT 응답은 `UserInfo` 를 그대로 사용합니다.
 */
export interface UserListItem extends UserInfo {
  groups: UserGroupSummary[]
}

/**
 * GET /api/user 조회 응답 payload 타입입니다.
 */
export interface UserPage {
  items: UserListItem[]
  offset: number
  limit: number
  count: number
}

export type UserPageResponse = ApiResponse<UserPage>
export type UserInfoResponse = ApiResponse<UserInfo>

/**
 * UserController PUT 응답은 최신 UserInfo 를 data 로 반환합니다.
 */
export type UserUpdateResponse = ApiResponse<UserInfo>

/**
 * UserController POST 응답입니다.
 */
export type UserCreateResponse = ApiResponse<UserInfo>

/**
 * 비밀번호 변경 응답은 data=null 성공 래퍼입니다.
 */
export type UserPasswordResetResponse = ApiResponse<null>

/**
 * DELETE /api/user/{userPk} 응답입니다.
 */
export type UserDeleteResponse = ApiResponse<null>

/**
 * 백엔드 `UiUserStatus` enum 4값과 정확히 일치하는 union 입니다.
 */
export type UiUserStatusLiteral = 'ACTIVE' | 'LOCKED' | 'DISABLED' | 'DELETED'

/**
 * POST /api/user 요청 DTO 입니다. password 가 필수입니다.
 */
export interface UserCreateRequest {
  company: string
  department: string
  userName: string
  userId: string
  password: string
  email: string
  status: UiUserStatusLiteral
  createdBy?: string | null
  updatedBy?: string | null
}

/**
 * PUT /api/user/{userPk} 요청 DTO 입니다.
 * password=null/생략 이면 기존 비밀번호를 유지합니다.
 */
export interface UserUpdateRequest {
  company: string
  department: string
  userName: string
  userId: string
  password?: string | null
  email: string
  status: string
  createdBy?: string | null
  updatedBy?: string | null
}

/**
 * POST /api/user/{userPk}/password/reset 요청 DTO 입니다.
 */
export interface UserPasswordResetRequest {
  newPassword: string
  updatedBy?: string | null
}

/**
 * User API 계층 공통 실패 응답 타입입니다.
 */
export type UserFailResponse = ApiResponse<null> & {
  success: false
  data: null
  errorCode: string
  errorMsg: string
}

/**
 * User API 기본 오류 메시지입니다.
 */
export const DEFAULT_USER_ERROR_MESSAGE =
  '사용자 정보를 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'

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
 * 실패 payload 를 UserFailResponse 형태로 정규화합니다.
 */
export const createUserFailResponse = (
  payload: unknown,
  fallbackMessage = DEFAULT_USER_ERROR_MESSAGE,
): UserFailResponse => {
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
 * User API 레이어 전용 에러 객체입니다. `ProfileApiError` 와 같은 형상을 갖습니다.
 */
export class UserApiError extends Error {
  public readonly payload: UserFailResponse
  public readonly status?: number

  constructor(payload: UserFailResponse, status?: number) {
    super(payload.errorMsg)
    this.name = 'UserApiError'
    this.payload = payload
    this.status = status
  }
}
