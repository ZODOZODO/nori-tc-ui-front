/**
 * Dash Live Map 페이지 접근 권한 코드입니다.
 * 운영 DB 의 권한 카탈로그는 'LIVE_MAP_READ' 로 등록되어 있어 이에 맞춤.
 */
export const DASH_READ_PERMISSION = 'LIVE_MAP_READ'

/**
 * User / Group 관리 페이지 조회 권한 코드입니다.
 */
export const USER_READ_PERMISSION = 'USER_READ'

/**
 * DLQ / Quarantine / Repair Task 모니터링 페이지 조회 권한 코드입니다.
 * DB seed 의 PREFIX `/api/dlq` 매칭이 신규 endpoint 도 자동 커버.
 */
export const DLQ_READ_PERMISSION = 'DLQ_READ'

/**
 * Live Map 레이아웃(2.5D 캔버스) 편집 권한 코드입니다.
 * DB seed 는 PREFIX `/api/live-map/layout`. Phase 1 은 상수/hasPermission 배선만,
 * 실제 게이팅(그리기/편집/복제 admin 전용)은 Phase 2 에서 사용.
 */
export const LIVE_MAP_LAYOUT_WRITE_PERMISSION = 'LIVE_MAP_LAYOUT_WRITE'

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
