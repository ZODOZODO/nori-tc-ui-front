import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { AppTopNavigationKey } from '../lib/app-navigation'
import { APP_TOP_BAR_OFFSET_CLASS, AppTopBar } from './AppTopBar'

interface AppPageShellProps {
  currentMenu: AppTopNavigationKey
  onOpenProfile: () => void
  onAfterLogout?: () => void | Promise<void>
  children: ReactNode
  className?: string
}

export function AppPageShell({
  currentMenu,
  onOpenProfile,
  onAfterLogout,
  children,
  className,
}: AppPageShellProps) {
  return (
    <div className="flex h-screen min-h-screen min-w-0 w-full flex-col overflow-hidden bg-[#F7FAF8]">
      <AppTopBar
        currentMenu={currentMenu}
        onOpenProfile={onOpenProfile}
        onAfterLogout={onAfterLogout}
      />
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', APP_TOP_BAR_OFFSET_CLASS, className)}>
        {children}
      </div>
    </div>
  )
}
