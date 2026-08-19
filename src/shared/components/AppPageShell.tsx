import type { ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { AppLnbSidebar } from './AppLnbSidebar'
import { AppTopBar } from './AppTopBar'

interface AppPageShellProps {
  onOpenProfile: () => void
  onAfterLogout?: () => void | Promise<void>
  children: ReactNode
  className?: string
}

/**
 * 앱 셸입니다 — 좌측 LNB + 본문(얇은 헤더 + 페이지) 2열 구조(SPEC R7).
 *
 * <p>구 구조는 fixed 상단 탑바 + 본문 상단 패딩이었다. LNB 전환 후 본문은 정상 흐름이라
 * 오프셋 패딩이 필요 없다.</p>
 */
export function AppPageShell({
  onOpenProfile,
  onAfterLogout,
  children,
  className,
}: AppPageShellProps) {
  return (
    <SidebarProvider>
      <AppLnbSidebar />
      <SidebarInset>
        <AppTopBar onOpenProfile={onOpenProfile} onAfterLogout={onAfterLogout} />
        <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', className)}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
