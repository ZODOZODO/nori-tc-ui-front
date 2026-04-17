import { DASH_READ_PERMISSION, hasPermission } from './permission'

export type AppTopNavigationKey = 'eqp' | 'model' | 'dash' | 'deploy' | 'dlq' | 'user'

export interface AppTopNavigationItem {
  key: AppTopNavigationKey
  label: string
  route: string | null
  requiredPermission?: string
}

export const APP_TOP_NAVIGATION_ITEMS: readonly AppTopNavigationItem[] = [
  { key: 'dash', label: 'Dash', route: '/eqp/live-map', requiredPermission: DASH_READ_PERMISSION },
  { key: 'eqp', label: 'Eqp', route: '/eqp' },
  { key: 'model', label: 'Model', route: '/model' },
  { key: 'deploy', label: 'Deploy', route: '/deploy' },
  { key: 'dlq', label: 'Dlq', route: null },
  { key: 'user', label: 'User', route: null },
] as const

/**
 * 보유 권한 기준으로 topbar 메뉴를 필터링합니다.
 */
export const resolveVisibleAppNavigationItems = (
  permissionCodes: readonly string[] | null | undefined,
): AppTopNavigationItem[] =>
  APP_TOP_NAVIGATION_ITEMS.filter(
    (item) => !item.requiredPermission || hasPermission(permissionCodes, item.requiredPermission),
  )
