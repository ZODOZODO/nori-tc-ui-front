import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { useMe } from '@/features/profile/hooks/useProfile'
import { hasPermission } from '../lib/permission'

interface PermissionRouteProps extends PropsWithChildren {
  permissionCode: string
  fallbackRoute?: string
}

/**
 * 특정 권한이 없는 사용자의 route 직접 진입을 막습니다.
 */
export function PermissionRoute({
  children,
  permissionCode,
  fallbackRoute = '/eqp',
}: PermissionRouteProps) {
  const meQuery = useMe()

  if (meQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6FBF8] px-6 text-sm text-[#4B5A52]">
        권한을 확인하는 중입니다.
      </div>
    )
  }

  if (!hasPermission(meQuery.data?.permissionCodes, permissionCode)) {
    return <Navigate to={fallbackRoute} replace />
  }

  return <>{children}</>
}
