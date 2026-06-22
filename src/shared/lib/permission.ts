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
 * Live Map 레이아웃 조회 권한 코드입니다.
 * DB seed 는 PREFIX `/api/live-map/layout` + `http_method='GET'`, ADMIN/DEVELOPER/OPERATOR backfill.
 * 3D 등각 뷰어는 이 권한만으로 구조물/배치를 GET 해 읽기 전용으로 볼 수 있다(편집은 WRITE 필요).
 */
export const LIVE_MAP_LAYOUT_READ_PERMISSION = 'LIVE_MAP_LAYOUT_READ'

/**
 * 데모 시나리오 삭제 권한 코드입니다.
 * DB seed 는 PREFIX `/api/live-map/demo-runs/scenarios` + `http_method='DELETE'`, ADMIN 명시 매핑.
 * 업로드(POST)는 기존 `LIVE_MAP_DEMO_RUN_WRITE` 가 커버하므로 별도 코드가 없습니다(삭제만 게이팅).
 */
export const LIVE_MAP_DEMO_RUN_SCENARIO_DELETE_PERMISSION = 'LIVE_MAP_DEMO_RUN_SCENARIO_DELETE'

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
