import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const LoginPage = lazy(async () => {
  const module = await import('@/features/auth/components/LoginPage')
  return { default: module.LoginPage }
})

const EqpPage = lazy(async () => {
  const module = await import('@/features/eqp/components/EqpPage')
  return { default: module.EqpPage }
})

const ModelPage = lazy(async () => {
  const module = await import('@/features/model/components/ModelPage')
  return { default: module.ModelPage }
})

const DeployPage = lazy(async () => {
  const module = await import('@/features/deploy/components/DeployPage')
  return { default: module.DeployPage }
})

const LiveMapPage = lazy(async () => {
  const module = await import('@/features/live-map/components/LiveMapPage')
  return { default: module.LiveMapPage }
})

const UserManagementPage = lazy(async () => {
  const module = await import('@/features/user-management/components/UserManagementPage')
  return { default: module.UserManagementPage }
})

const DlqPage = lazy(async () => {
  const module = await import('@/features/dlq/components/DlqPage')
  return { default: module.DlqPage }
})

// R6 (정렬 / 리사이즈 / 가상화) e2e 전용 fixture — DEV 빌드에서만 라우트 등록.
const SelectableTableFixture = lazy(async () => {
  const module = await import('@/dev/SelectableTableFixture')
  return { default: module.SelectableTableFixture }
})

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6FBF8] px-6 text-sm text-[#4B5A52]">
      화면을 불러오는 중입니다.
    </div>
  )
}

export function Router() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/eqp" element={<EqpPage />} />
        <Route path="/eqp/live-map" element={<LiveMapPage />} />
        <Route path="/model" element={<ModelPage />} />
        <Route path="/deploy" element={<DeployPage />} />
        <Route path="/dlq" element={<DlqPage />} />
        <Route path="/user" element={<UserManagementPage />} />
        {import.meta.env.DEV ? (
          <Route path="/__fixtures/selectable-table" element={<SelectableTableFixture />} />
        ) : null}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
