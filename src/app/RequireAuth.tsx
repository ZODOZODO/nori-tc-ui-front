import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useMe } from '@/features/profile/hooks/useProfile'
import { useI18n } from '@/i18n/i18n-context'

const LOGIN_ROUTE = '/login'

/**
 * 보호 라우트의 사전 인증 가드.
 *
 * 종전 인증 판정은 `api-client.ts` 의 401 인터셉터뿐이었다(사후 차단) — 즉 화면이 먼저 렌더되고
 * 그 안에서 sessionStorage 에 남은 이전 사용자 상태가 그려진 뒤에야 /login 으로 튕겼다(S09 E-3).
 * 여기서 `/auth/me` 결과로 먼저 판정해 미인증이면 본문을 렌더하지 않는다.
 *
 * 서버 데이터 경계는 백엔드가 지킨다(closed-by-default). 이 가드는 잔여 렌더를 막는 클라이언트 방어선이다.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const meQuery = useMe(true)

  if (meQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground">
        {t('common.routeLoading')}
      </div>
    )
  }

  if (meQuery.isError || !meQuery.data) {
    return <Navigate to={LOGIN_ROUTE} replace />
  }

  return children
}
