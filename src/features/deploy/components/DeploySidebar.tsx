import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DeployMode } from '../types/deploy.types'

interface DeploySidebarProps {
  mode: DeployMode
  onChangeMode: (mode: DeployMode) => void
}

const SIDEBAR_ITEMS: Array<{ mode: DeployMode; label: string }> = [
  { mode: 'register', label: 'Register' },
  { mode: 'deploy', label: 'Deploy' },
  { mode: 'history', label: 'Deploy_History' },
]

export function DeploySidebar({ mode, onChangeMode }: DeploySidebarProps) {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-[#DCE5DB] bg-white">
      <div className="flex h-[52px] items-center border-b border-[#E4EAE6] px-3">
        <span className="flex items-center gap-1 text-sm font-semibold text-[#243129]">
          <ChevronDown className="size-4 text-[#516058]" />
          Deploy
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-2 py-3">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = item.mode === mode

          return (
            <Button
              key={item.mode}
              type="button"
              variant="ghost"
              onClick={() => onChangeMode(item.mode)}
              className={cn(
                'h-9 justify-start rounded-lg px-3 text-sm font-medium',
                isActive
                  ? 'bg-[#EAF5EE] text-[#1F2D26] hover:bg-[#EAF5EE]'
                  : 'text-[#51605A] hover:bg-[#F1F6F3] hover:text-[#2B4A3F]',
              )}
            >
              {item.label}
            </Button>
          )
        })}
      </nav>
    </aside>
  )
}
