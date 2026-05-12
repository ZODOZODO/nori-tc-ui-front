import type { ApiResponse } from '@/features/auth/types/auth.types'
import {
  createUserFailResponse,
  DEFAULT_USER_ERROR_MESSAGE,
  isApiResponse,
  isRecord,
  UserApiError,
  type UserFailResponse,
  type UserInfo,
  type UserInfoResponse,
  type UserPage,
  type UserPageResponse,
  type UserPasswordResetRequest,
  type UserPasswordResetResponse,
  type UserUpdateRequest,
  type UserUpdateResponse,
} from '@/features/user/types'

/**
 * GET /api/auth/me 응답 payload 타입입니다.
 */
export interface MeInfo {
  userPk: number
  userId: string
  permissionCodes: string[]
}

export type MeResponse = ApiResponse<MeInfo>

/**
 * Profile API 기본 오류 메시지입니다. user 모듈의 메시지를 그대로 재사용합니다.
 */
export const DEFAULT_PROFILE_ERROR_MESSAGE = DEFAULT_USER_ERROR_MESSAGE

/**
 * 기존 호출처(UserProfileModal 등) 호환을 위해 user 모듈의 헬퍼를 그대로 re-export 합니다.
 */
export { isApiResponse, isRecord }

/**
 * 기존 호출처 호환용 alias 입니다. UserApiError 와 동일 인스턴스를 가리킵니다.
 */
export const ProfileApiError = UserApiError
export type ProfileApiError = UserApiError

export type ProfileFailResponse = UserFailResponse

export const createProfileFailResponse = (
  payload: unknown,
  fallbackMessage: string = DEFAULT_PROFILE_ERROR_MESSAGE,
): ProfileFailResponse => createUserFailResponse(payload, fallbackMessage)

export type {
  UserInfo,
  UserPage,
  UserPageResponse,
  UserUpdateRequest,
  UserPasswordResetRequest,
  UserInfoResponse,
  UserUpdateResponse,
  UserPasswordResetResponse,
}
