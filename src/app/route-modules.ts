export const loadLoginPage = () => import('@/features/auth/components/LoginPage')
export const loadEqpPage = () => import('@/features/eqp/components/EqpPage')
export const loadModelPage = () => import('@/features/model/components/ModelPage')
export const loadDeployPage = () => import('@/features/deploy/components/DeployPage')
export const loadLiveMapPage = () => import('@/features/live-map/components/LiveMapPage')
export const loadDlqPage = () => import('@/features/dlq/components/DlqPage')
export const loadUserManagementPage = () =>
  import('@/features/user-management/components/UserManagementPage')

type RouteModuleLoader = () => Promise<unknown>

/**
 * 경로 → lazy 모듈 loader 표입니다.
 *
 * <p>확정 트리의 8 라우트 + `/login` + `/` 에 더해 **구 경로 14종**도 담는다 — 리다이렉트
 * 목적지와 같은 loader 를 매핑해, 북마크로 구 경로에 들어온 사용자의 preload 도 히트하게 한다.</p>
 */
const ROUTE_MODULE_LOADERS: Readonly<Record<string, RouteModuleLoader>> = {
  '/': loadLoginPage,
  '/login': loadLoginPage,

  '/live-map': loadLiveMapPage,

  '/dlq': loadDlqPage,

  '/eqp': loadEqpPage,

  '/model/secs': loadModelPage,
  '/model/socket': loadModelPage,
  '/model/plc': loadModelPage,

  '/deploy': loadDeployPage,

  '/user': loadUserManagementPage,

  // 구 경로 — Router 가 리다이렉트하지만 첫 진입 preload 는 여기서 히트해야 한다.
  '/dlq/dashboard': loadDlqPage,
  '/dlq/gateway': loadDlqPage,
  '/dlq/business': loadDlqPage,
  '/dlq/quarantine': loadDlqPage,
  '/dlq/repair-task': loadDlqPage,
  '/eqp/business': loadEqpPage,
  '/eqp/gateway': loadEqpPage,
  '/model': loadModelPage,
  '/deploy/register': loadDeployPage,
  '/deploy/deploy': loadDeployPage,
  '/deploy/history': loadDeployPage,
  '/user/users': loadUserManagementPage,
  '/user/groups': loadUserManagementPage,
  '/eqp/live-map': loadLiveMapPage,
}

/**
 * 현재 경로나 사용자가 가리킨 메뉴의 lazy 모듈을 미리 받습니다.
 *
 * <p>같은 `import()` 함수를 Router 의 `lazy()` 도 쓰므로 브라우저 모듈 캐시를 그대로 재사용한다 —
 * loader 를 따로 만들면 preload 가 캐시를 못 맞춰 두 번 받는다.</p>
 */
export const preloadRouteModule = async (pathname: string): Promise<void> => {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const loader = ROUTE_MODULE_LOADERS[normalizedPath]
  if (loader) {
    await loader()
  }
}
