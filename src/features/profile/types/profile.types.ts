import type { ApiResponse } from '@/features/auth/types/auth.types'

/**
 * GET /api/auth/me 응답 payload 타입입니다.
 */
export interface MeInfo {
  userPk: number
  userId: string
  permissionCodes: string[]
}

/**
 * GET /api/user/{userPk} 응답 payload 타입입니다.
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
 * GET /api/user 조회 응답 payload 타입입니다.
 */
export interface UserPage {
  items: UserInfo[]
  offset: number
  limit: number
  count: number
}

/**
 * GET /api/user 응답 래퍼 타입입니다.
 */
export type UserPageResponse = ApiResponse<UserPage>

/**
 * PUT /api/user/{userPk} 요청 DTO 입니다.
 * password=null이면 기존 비밀번호를 유지합니다.
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

export type MeResponse = ApiResponse<MeInfo>
export type UserInfoResponse = ApiResponse<UserInfo>

/**
 * UserController PUT 응답은 최신 UserInfo를 data로 반환합니다.
 */
export type UserUpdateResponse = ApiResponse<UserInfo>

/**
 * 비밀번호 변경 응답은 data=null 성공 래퍼입니다.
 */
export type UserPasswordResetResponse = ApiResponse<null>

/**
 * Profile API 계층 공통 실패 타입입니다.
 */
export type ProfileFailResponse = ApiResponse<null> & {
  success: false
  data: null
  errorCode: string
  errorMsg: string
}

/**
 * Profile API 기본 오류 메시지입니다.
 */
export const DEFAULT_PROFILE_ERROR_MESSAGE =
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
 * 실패 payload를 ProfileFailResponse 형태로 정규화합니다.
 */
export const createProfileFailResponse = (
  payload: unknown,
  fallbackMessage = DEFAULT_PROFILE_ERROR_MESSAGE,
): ProfileFailResponse => {
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
 * Profile API 레이어 전용 에러 객체입니다.
 */
export class ProfileApiError extends Error {
  public readonly payload: ProfileFailResponse
  public readonly status?: number

  constructor(payload: ProfileFailResponse, status?: number) {
    super(payload.errorMsg)
    this.name = 'ProfileApiError'
    this.payload = payload
    this.status = status
  }
}
