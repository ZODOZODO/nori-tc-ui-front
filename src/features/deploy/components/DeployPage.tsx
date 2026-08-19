import { useEffect, useMemo } from 'react'
import { AppShellPage } from '@/shared/components/AppShellPage'
import { DeployHistoryPanel } from './DeployHistoryPanel'
import { DeployMonitorPanel } from './DeployMonitorPanel'
import { DeployRegisterPanel } from './DeployRegisterPanel'
import { clearDeployUiSessionState } from '../stores/deploy-ui.store'
import type { DeployMode } from '../types/deploy.types'

interface DeployPageProps {
  /** 표시할 모드. 라우트가 정한다 — URL 이 단일 진실 원천이다. */
  mode: DeployMode
}

const renderPanel = (mode: DeployMode) => {
  switch (mode) {
    case 'register':
      return <DeployRegisterPanel />
    case 'deploy':
      return <DeployMonitorPanel />
    case 'history':
      return <DeployHistoryPanel />
  }
}

/**
 * `/deploy/*` 라우트의 통합 페이지입니다. 인증·DEPLOY_READ 권한 검사는 라우트 가드
 * (RequireAuth / RequirePermission)가 담당한다.
 *
 * 등록 / 배포 / 배포 이력 전환은 전역 LNB 가 맡는다.
 */
export function DeployPage({ mode }: DeployPageProps) {
  const activePanel = useMemo(() => renderPanel(mode), [mode])

  useEffect(() => {
    return () => {
      // 모드가 라우트로 갈리면서 이 페이지는 모드 전환마다 remount 된다
      // (`Router` 의 `ErrorBoundary key={pathname}`). deploy 구역 *안* 에서의 이동까지 세션 상태를
      // 지우면 방금 만든 배포의 activeDeployKey / localHistory 가 사라져 모니터 화면이 빈다.
      // cleanup 시점의 `window.location` 은 이미 다음 경로다(history 갱신 → 리렌더 → cleanup).
      if (!window.location.pathname.startsWith('/deploy')) {
        clearDeployUiSessionState()
      }
    }
  }, [])

  return (
    <AppShellPage onAfterLogout={clearDeployUiSessionState}>
      <main className="flex min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex min-h-full min-w-0 max-w-full flex-1 p-6">{activePanel}</div>
      </main>
    </AppShellPage>
  )
}
