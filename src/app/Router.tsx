import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { useI18n } from '@/i18n/i18n-context'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { RequireAuth } from './RequireAuth'
import {
  loadDeployPage,
  loadDlqPage,
  loadEqpPage,
  loadLiveMapPage,
  loadLoginPage,
  loadModelPage,
  loadUserManagementPage,
  preloadRouteModule,
} from './route-modules'

// lazy 와 preload 가 같은 import() 를 공유해야 브라우저 모듈 캐시가 맞는다 — loader 를 따로
// 쓰면 hover preload 가 캐시를 못 맞춰 청크를 두 번 받는다.
const LoginPage = lazy(async () => ({ default: (await loadLoginPage()).LoginPage }))
const EqpPage = lazy(async () => ({ default: (await loadEqpPage()).EqpPage }))
const ModelPage = lazy(async () => ({ default: (await loadModelPage()).ModelPage }))
const DeployPage = lazy(async () => ({ default: (await loadDeployPage()).DeployPage }))
const LiveMapPage = lazy(async () => ({ default: (await loadLiveMapPage()).LiveMapPage }))
const DlqPage = lazy(async () => ({ default: (await loadDlqPage()).DlqPage }))
const UserManagementPage = lazy(async () => ({
  default: (await loadUserManagementPage()).UserManagementPage,
}))

// R6 (정렬 / 리사이즈 / 가상화) e2e 전용 fixture — DEV 빌드에서만 라우트 등록.
const SelectableTableFixture = lazy(async () => {
  const module = await import('@/dev/SelectableTableFixture')
  return { default: module.SelectableTableFixture }
})

// R8 (공통 layout shell pattern) 시각 확인 전용 fixture — DEV 빌드에서만 라우트 등록.
const LayoutShellFixture = lazy(async () => {
  const module = await import('@/dev/LayoutShellFixture')
  return { default: module.LayoutShellFixture }
})

// 첫 진입 경로의 청크를 라우터 평가 전에 미리 받는다 — Suspense 폴백 노출 시간을 줄인다.
void preloadRouteModule(window.location.pathname).catch(() => undefined)

function RouteLoadingFallback() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
      {t('common.routeLoading')}
    </div>
  )
}

/**
 * 앱 라우트 트리입니다.
 *
 * <p>LNB 확정 트리의 16 항목이 그대로 라우트다 — 모드/스코프는 store 가 아니라 URL 이 원천이고,
 * 페이지는 그 값을 prop 으로 받는다(새로고침·딥링크 복원이 URL 만으로 성립).</p>
 *
 * <p>세그먼트를 `:mode` param 으로 받지 않고 정적으로 나열한다 — 미존재 세그먼트가 자동으로
 * `*` → `/login` 에 떨어져 유효성 분기를 따로 두지 않아도 된다.</p>
 */
export function Router() {
  const location = useLocation()
  return (
    // 라우트가 바뀌면 경계를 초기화한다 — 한 화면의 청크 404 가 다른 화면까지 계속 막지 않게.
    <ErrorBoundary key={location.pathname} scope="route">
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          {/* /login 은 가드 밖 — 안에 넣으면 미인증 시 리다이렉트 루프가 된다. */}
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/live-map" element={<LiveMapPage />} />

            <Route path="/dlq/dashboard" element={<DlqPage mode="dashboard" />} />
            <Route path="/dlq/gateway" element={<DlqPage mode="gateway" />} />
            <Route path="/dlq/business" element={<DlqPage mode="business" />} />
            <Route path="/dlq/quarantine" element={<DlqPage mode="quarantine" />} />
            <Route path="/dlq/repair-task" element={<DlqPage mode="repair-task" />} />

            <Route path="/eqp/business" element={<EqpPage scope="business" />} />
            <Route path="/eqp/gateway" element={<EqpPage scope="gateway" />} />

            <Route path="/model/secs" element={<ModelPage scope="SECS" />} />
            <Route path="/model/socket" element={<ModelPage scope="SOCKET" />} />
            <Route path="/model/plc" element={<ModelPage scope="PLC" />} />

            <Route path="/deploy/register" element={<DeployPage mode="register" />} />
            <Route path="/deploy/deploy" element={<DeployPage mode="deploy" />} />
            <Route path="/deploy/history" element={<DeployPage mode="history" />} />

            <Route path="/user/users" element={<UserManagementPage mode="user" />} />
            <Route path="/user/groups" element={<UserManagementPage mode="group" />} />
          </Route>

          {/* 구 경로 — 북마크 보존. 목적지는 각 화면의 기존 초기 모드다. */}
          <Route path="/dlq" element={<Navigate to="/dlq/dashboard" replace />} />
          <Route path="/eqp" element={<Navigate to="/eqp/gateway" replace />} />
          <Route path="/model" element={<Navigate to="/model/secs" replace />} />
          <Route path="/deploy" element={<Navigate to="/deploy/register" replace />} />
          <Route path="/user" element={<Navigate to="/user/users" replace />} />
          <Route path="/eqp/live-map" element={<Navigate to="/live-map" replace />} />

          {import.meta.env.DEV ? (
            <Route path="/__fixtures/selectable-table" element={<SelectableTableFixture />} />
          ) : null}
          {import.meta.env.DEV ? (
            <Route path="/__fixtures/layout-shell" element={<LayoutShellFixture />} />
          ) : null}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
