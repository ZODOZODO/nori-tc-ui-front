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

const UserPage = lazy(async () => {
  const module = await import('@/features/user/components/UserPage')
  return { default: module.UserPage }
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
        <Route path="/user" element={<UserPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
