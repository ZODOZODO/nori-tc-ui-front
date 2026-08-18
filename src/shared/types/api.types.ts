/**
 * 백엔드 공통 응답 래퍼 타입입니다.
 * - success: 요청 처리 성공 여부
 * - data: 성공 시 데이터, 실패 시 null
 * - errorCode/errorMsg: 실패 시 에러 메타데이터
 */
export interface ApiResponse<TData> {
  success: boolean
  data: TData | null
  errorCode: string | null
  errorMsg: string | null
}

/**
 * 런타임 타입 가드를 위한 공용 객체 검사 유틸입니다.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * ApiResponse 구조인지 확인합니다.
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
