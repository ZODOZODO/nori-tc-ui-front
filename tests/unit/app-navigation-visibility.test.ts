import assert from 'node:assert/strict'
import test from 'node:test'
import {
  APP_NAVIGATION_GROUPS,
  isAppNavigationRouteActive,
  resolveAppNavigationLocation,
  resolveVisibleAppNavigationGroups,
} from '@/shared/lib/app-navigation.ts'

/**
 * SPEC .claude/specs/wm-parity-sidebar.md R2 / AC3 — LNB 2단 트리의 권한 필터 게이트.
 *
 * 필터가 사라지면 권한 없는 사용자에게 메뉴가 노출된다. 데이터 경계는 백엔드
 * closed-by-default 가 지키므로 유출은 아니지만, 눌러도 AccessDeniedNotice 만 나오는 메뉴가
 * 보이는 것은 그 자체로 결함이다(구 topbar 의 `resolveVisibleAppNavigationItems` 가 지키던 성질).
 *
 * 항목 숨김뿐 아니라 **빈 그룹째 숨김**까지 단언한다 — 항목 필터만 남기고 그룹 필터가 빠지면
 * 하위가 하나도 없는 그룹 헤더가 rail 에 남는다.
 */

/** 확정 메뉴 트리(SPEC 표)의 권한 문자열 — 상수명이 아니라 값 기준이다. */
const ALL_PERMISSIONS = [
  'LIVE_MAP_READ',
  'DLQ_READ',
  'EQP_READ',
  'MODEL_READ',
  'DEPLOY_READ',
  'USER_READ',
]

const groupKeys = (permissionCodes: readonly string[] | null | undefined): string[] =>
  resolveVisibleAppNavigationGroups(permissionCodes).map((group) => group.key)

const itemKeys = (permissionCodes: readonly string[] | null | undefined): string[] =>
  resolveVisibleAppNavigationGroups(permissionCodes).flatMap((group) =>
    group.items.map((item) => item.key),
  )

test('확정 메뉴 트리는 5 그룹 / 8 항목이다 (SPEC 표 고정)', () => {
  assert.equal(APP_NAVIGATION_GROUPS.length, 5)
  assert.equal(
    APP_NAVIGATION_GROUPS.reduce((total, group) => total + group.items.length, 0),
    8,
  )
  assert.deepEqual(APP_NAVIGATION_GROUPS.map((group) => group.key), [
    'monitoring',
    'equipment',
    'model',
    'deploy',
    'system',
  ])
})

test('전 권한 보유자는 5 그룹 8 항목을 모두 본다', () => {
  assert.equal(groupKeys(ALL_PERMISSIONS).length, 5)
  assert.equal(itemKeys(ALL_PERMISSIONS).length, 8)
})

test('권한 0 이면 그룹도 항목도 남지 않는다', () => {
  assert.deepEqual(groupKeys([]), [])
  assert.deepEqual(groupKeys(null), [])
  assert.deepEqual(groupKeys(undefined), [])
  assert.deepEqual(groupKeys(['AUTH_ME_PERM']), [])
})

test('권한 없는 항목은 숨기고, 항목이 0 이 된 그룹은 그룹째 숨긴다', () => {
  // DLQ_READ 만 보유 — monitoring 그룹의 DLQ 항목만 남고(Live-Map 은 숨김) 나머지 그룹은 통째로 사라져야 한다.
  assert.deepEqual(groupKeys(['DLQ_READ']), ['monitoring'])
  assert.deepEqual(itemKeys(['DLQ_READ']), ['dlq'])
})

test('부분 권한 조합은 해당 그룹만 순서대로 노출한다', () => {
  assert.deepEqual(groupKeys(['EQP_READ', 'USER_READ']), ['equipment', 'system'])
  assert.deepEqual(itemKeys(['EQP_READ', 'USER_READ']), ['eqp', 'user'])
})

test('Live-Map 항목은 상수명이 아니라 값 LIVE_MAP_READ 로 게이팅된다', () => {
  assert.deepEqual(groupKeys(['LIVE_MAP_READ']), ['monitoring'])
  assert.deepEqual(groupKeys(['DASH_READ']), [])
})

test('활성 판정은 항목 route 자신과 하위 경로만 참이다', () => {
  assert.equal(isAppNavigationRouteActive('/dlq/gateway', '/dlq/gateway'), true)
  assert.equal(isAppNavigationRouteActive('/dlq/gateway/detail', '/dlq/gateway'), true)
  // 형제 세그먼트가 접두사로 오인되면 두 항목이 동시에 활성으로 보인다.
  assert.equal(isAppNavigationRouteActive('/dlq/gateway', '/dlq/business'), false)
  assert.equal(isAppNavigationRouteActive('/dlq/gateway-extra', '/dlq/gateway'), false)
})

test('경로 → LNB 위치 역해석은 권한 필터와 무관하게 정의 전체를 본다', () => {
  const location = resolveAppNavigationLocation('/model/plc')
  assert.equal(location?.group.key, 'model')
  assert.equal(location?.item.key, 'modelPlc')

  // LNB 에 없는 경로는 null — 호출부가 breadcrumb/아이콘을 생략한다.
  assert.equal(resolveAppNavigationLocation('/login'), null)
  assert.equal(resolveAppNavigationLocation('/__fixtures/layout-shell'), null)
})
