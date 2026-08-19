import type { ApiResponse } from '@/shared/types/api.types'
import {
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
