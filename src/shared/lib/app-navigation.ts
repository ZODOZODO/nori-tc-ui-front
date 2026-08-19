import {
  DASH_READ_PERMISSION,
  DEPLOY_READ_PERMISSION,
  DLQ_READ_PERMISSION,
  EQP_READ_PERMISSION,
  hasPermission,
  MODEL_READ_PERMISSION,
  USER_READ_PERMISSION,
} from './permission'

/**
 * LNB 1차 내비 그룹 key — SPEC 확정 6 그룹(2026-08-18 사용자 확정 트리).
 *
 * <p>구 topbar 의 flat 6 항목이 그대로 그룹이 되고, 각 페이지 도메인 사이드바의 1단계 항목이
 * 그 그룹의 menu-label 로 승격된다. `monitoring` 만 항목이 하나(Live-Map)인데, 그룹 축을
 * "모니터링 / 처리실패 / 설비 / 모델 / 적용 / 시스템" 으로 맞추기 위해 유지한다.</p>
 */
export type AppNavigationGroupKey =
  | 'monitoring'
  | 'dlq'
  | 'equipment'
  | 'model'
  | 'deploy'
  | 'system'

/** LNB 항목 key — 각 항목이 곧 라우트다. */
export type AppNavigationItemKey =
  | 'liveMap'
  | 'dlqDashboard'
  | 'dlqGateway'
  | 'dlqBusiness'
  | 'dlqQuarantine'
  | 'dlqRepairTask'
  | 'eqpBusiness'
  | 'eqpGateway'
  | 'modelSecs'
  | 'modelSocket'
  | 'modelPlc'
  | 'deployRegister'
  | 'deployDeploy'
  | 'deployHistory'
  | 'userUsers'
  | 'userGroups'

export interface AppNavigationItem {
  key: AppNavigationItemKey
  /** i18n 키 — ko/en/vi 3 언어 모두 존재한다. TC 고유명은 전 언어 영어. */
  labelKey: string
  route: string
  /** 미보유 시 LNB 에서 숨긴다. 모든 항목이 권한 게이트를 갖는다(default-deny 정합). */
  requiredPermission: string
}

export interface AppNavigationGroup {
  key: AppNavigationGroupKey
  labelKey: string
  items: readonly AppNavigationItem[]
}

/**
 * LNB 2단 그룹 정의입니다 — SPEC 의 확정 메뉴 트리 표가 단일 진실 원천이다(변경 시 SPEC 재승인).
 *
 * <p>권한은 상수명이 아니라 **값 문자열** 기준으로 바인딩한다. Live-Map 만 상수명과 값이
 * 다르다: `DASH_READ_PERMISSION` 의 값이 `'LIVE_MAP_READ'` 다(permission.ts:5).</p>
 *
 * <p>항목 순서가 화면 순서다.</p>
 */
export const APP_NAVIGATION_GROUPS: readonly AppNavigationGroup[] = [
  {
    key: 'monitoring',
    labelKey: 'navigation.group.monitoring',
    items: [
      {
        key: 'liveMap',
        labelKey: 'navigation.item.liveMap',
        route: '/live-map',
        requiredPermission: DASH_READ_PERMISSION,
      },
    ],
  },
  {
    key: 'dlq',
    labelKey: 'navigation.group.dlq',
    items: [
      {
        key: 'dlqDashboard',
        labelKey: 'navigation.item.dlqDashboard',
        route: '/dlq/dashboard',
        requiredPermission: DLQ_READ_PERMISSION,
      },
      {
        key: 'dlqGateway',
        labelKey: 'navigation.item.dlqGateway',
        route: '/dlq/gateway',
        requiredPermission: DLQ_READ_PERMISSION,
      },
      {
        key: 'dlqBusiness',
        labelKey: 'navigation.item.dlqBusiness',
        route: '/dlq/business',
        requiredPermission: DLQ_READ_PERMISSION,
      },
      {
        key: 'dlqQuarantine',
        labelKey: 'navigation.item.dlqQuarantine',
        route: '/dlq/quarantine',
        requiredPermission: DLQ_READ_PERMISSION,
      },
      {
        key: 'dlqRepairTask',
        labelKey: 'navigation.item.dlqRepairTask',
        route: '/dlq/repair-task',
        requiredPermission: DLQ_READ_PERMISSION,
      },
    ],
  },
  {
    key: 'equipment',
    labelKey: 'navigation.group.equipment',
    items: [
      {
        key: 'eqpBusiness',
        labelKey: 'navigation.item.eqpBusiness',
        route: '/eqp/business',
        requiredPermission: EQP_READ_PERMISSION,
      },
      {
        key: 'eqpGateway',
        labelKey: 'navigation.item.eqpGateway',
        route: '/eqp/gateway',
        requiredPermission: EQP_READ_PERMISSION,
      },
    ],
  },
  {
    key: 'model',
    labelKey: 'navigation.group.model',
    items: [
      {
        key: 'modelSecs',
        labelKey: 'navigation.item.modelSecs',
        route: '/model/secs',
        requiredPermission: MODEL_READ_PERMISSION,
      },
      {
        key: 'modelSocket',
        labelKey: 'navigation.item.modelSocket',
        route: '/model/socket',
        requiredPermission: MODEL_READ_PERMISSION,
      },
      {
        key: 'modelPlc',
        labelKey: 'navigation.item.modelPlc',
        route: '/model/plc',
        requiredPermission: MODEL_READ_PERMISSION,
      },
    ],
  },
  {
    key: 'deploy',
    labelKey: 'navigation.group.deploy',
    items: [
      {
        key: 'deployRegister',
        labelKey: 'navigation.item.deployRegister',
        route: '/deploy/register',
        requiredPermission: DEPLOY_READ_PERMISSION,
      },
      {
        key: 'deployDeploy',
        labelKey: 'navigation.item.deployDeploy',
        route: '/deploy/deploy',
        requiredPermission: DEPLOY_READ_PERMISSION,
      },
      {
        key: 'deployHistory',
        labelKey: 'navigation.item.deployHistory',
        route: '/deploy/history',
        requiredPermission: DEPLOY_READ_PERMISSION,
      },
    ],
  },
  {
    key: 'system',
    labelKey: 'navigation.group.system',
    items: [
      {
        key: 'userUsers',
        labelKey: 'navigation.item.userUsers',
        route: '/user/users',
        requiredPermission: USER_READ_PERMISSION,
      },
      {
        key: 'userGroups',
        labelKey: 'navigation.item.userGroups',
        route: '/user/groups',
        requiredPermission: USER_READ_PERMISSION,
      },
    ],
  },
] as const

/**
 * 보유 권한으로 LNB 항목을 필터링합니다.
 *
 * <p>권한 없는 항목은 숨기고, 항목이 하나도 남지 않은 그룹은 그룹째 숨긴다 — 빈 그룹 헤더가
 * 남으면 접힘 rail 에 눌러도 아무것도 없는 아이콘이 생긴다.</p>
 */
export const resolveVisibleAppNavigationGroups = (
  permissionCodes: readonly string[] | null | undefined,
): AppNavigationGroup[] =>
  APP_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(permissionCodes, item.requiredPermission)),
  })).filter((group) => group.items.length > 0)

/** 현재 경로가 그 LNB 항목의 화면인지 — 항목 route 자신과 그 하위 경로만 해당한다. */
export const isAppNavigationRouteActive = (pathname: string, route: string): boolean =>
  pathname === route || pathname.startsWith(`${route}/`)

/** 경로가 속한 LNB 위치입니다 — breadcrumb(`Home › 그룹 › 항목`)와 페이지 아이콘의 단일 출처. */
export interface AppNavigationLocation {
  group: AppNavigationGroup
  item: AppNavigationItem
}

/**
 * 경로에서 LNB 위치를 되찾습니다 — 권한 필터와 무관하게 정의 전체를 본다.
 *
 * <p>LNB 에 없는 경로(`/login`·DEV fixture·리다이렉트 전용 구경로)는 `null` 이다 — 호출부가
 * breadcrumb/아이콘을 생략한다.</p>
 */
export const resolveAppNavigationLocation = (pathname: string): AppNavigationLocation | null => {
  for (const group of APP_NAVIGATION_GROUPS) {
    for (const item of group.items) {
      if (isAppNavigationRouteActive(pathname, item.route)) {
        return { group, item }
      }
    }
  }
  return null
}
