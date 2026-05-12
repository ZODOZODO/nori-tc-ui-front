/**
 * Dash Live Map 페이지 접근 권한 코드입니다.
 */
export const DASH_READ_PERMISSION = 'DASH_READ'

/**
 * User / Group 관리 페이지 조회 권한 코드입니다.
 */
export const USER_READ_PERMISSION = 'USER_READ'

/**
 * User / Group 관리 페이지 변경(등록/수정/삭제/그룹 매핑/비밀번호 초기화) 권한 코드입니다.
 */
export const USER_WRITE_PERMISSION = 'USER_WRITE'

/**
 * 사용자가 특정 권한 코드를 보유하는지 확인합니다.
 */
export const hasPermission = (
  permissionCodes: readonly string[] | null | undefined,
  permissionCode: string,
): boolean => {
  if (!permissionCodes || permissionCodes.length === 0) {
    return false
  }

  return permissionCodes.includes(permissionCode)
}
