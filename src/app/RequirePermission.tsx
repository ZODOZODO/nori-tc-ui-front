import { Outlet } from 'react-router'
import { useMe } from '@/features/profile/hooks/useProfile'
import { useI18n } from '@/i18n/i18n-context'
import { AccessDeniedNotice } from '@/shared/components/AccessDeniedNotice'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { hasPermission } from '@/shared/lib/permission'

interface RequirePermissionProps {
  /** 접근에 필요한 권한 코드. 확정 메뉴 트리의 권한 칼럼 값이다. */
  permissionCode: string
}

/**
 * 특정 권한 코드 보유를 요구하는 라우트 가드입니다.
 *
 * <p>{@link RequireAuth} 하위에서 사용한다. 미보유 시 `/login` 으로 조용히 튕기지 않고 "권한 없음"
 * 안내를 그 자리에 렌더한다 — 튕기면 사용자는 세션이 끊긴 것으로 오해한다.</p>
 */
export function RequirePermission({ permissionCode }: RequirePermissionProps) {
  const { t } = useI18n()
  const meQuery = useMe(true)

  // 인증 query 가 pending 인 동안 권한 없음으로 오판해 안내 화면을 띄우지 않는다.
  if (meQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        {t('common.routeLoading')}
      </div>
    )
  }

  if (!hasPermission(meQuery.data?.permissionCodes, permissionCode)) {
    return (
      <AppShellPage>
        <AccessDeniedNotice permissionCode={permissionCode} />
      </AppShellPage>
    )
  }

  return <Outlet />
}
