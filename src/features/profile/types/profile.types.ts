import type { ApiResponse } from '@/shared/types/api.types'
import {
  createUserFailResponse,
  defaultUserErrorMessage,
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
 * Profile API 기본 오류 메시지입니다. user 모듈의 메시지 getter 를 그대로 재사용합니다.
 */
export const defaultProfileErrorMessage = defaultUserErrorMessage

export type ProfileFailResponse = UserFailResponse

export const createProfileFailResponse = (
  payload: unknown,
  fallbackMessage: string = defaultProfileErrorMessage(),
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
