/**
 * Dash Live Map 페이지 접근 권한 코드입니다.
 */
export const DASH_READ_PERMISSION = 'DASH_READ'

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
