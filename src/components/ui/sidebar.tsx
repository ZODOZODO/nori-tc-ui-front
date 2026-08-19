import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { ChevronDown } from 'lucide-react'
import {
  SIDEBAR_COOKIE_MAX_AGE_SECONDS,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SIDEBAR_RAIL_WIDTH,
  SIDEBAR_TRANSITION_MS,
  SIDEBAR_WIDTH,
  SidebarContext,
  useSidebar,
} from './sidebar-context'

/**
 * shadcn/ui `Sidebar` primitive 를 nori-tc 가 쓰는 범위로 옮긴 구현입니다(SPEC R1).
 *
 * <p>원본에서 이 앱이 소비하지 않는 조각(SidebarInput/SidebarMenuBadge/SidebarMenuSkeleton/
 * SidebarMenuSub/SidebarRail/SidebarSeparator/variant floating·inset)은 두지 않는다 — 소비자 0 인
 * 표면을 들이면 유지 비용만 늘어난다.</p>
 *
 * <p>모션은 `translate3d` + 180ms 이고 `prefers-reduced-motion` 이면 transition 을 제거한다. 접힘 상태는
 * 쿠키에 남아 새로고침·재로그인 후에도 유지된다.</p>
 *
 * <p>데스크톱 접힘은 숨김이 아니라 56px 아이콘 rail 이다 — 접은 상태에서도 그룹 아이콘과
 * 플라이아웃으로 이동할 수 있어야 하므로 패널을 `aria-hidden`/`inert` 로 잠그지 않는다.
 * 모바일은 그대로 off-canvas 다.</p>
 */

const readSidebarStateCookie = (): boolean | null => {
  const entry = document.cookie
    .split('; ')
    .find((chunk) => chunk.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
  if (entry === undefined) {
    return null
  }
  const value = entry.slice(SIDEBAR_COOKIE_NAME.length + 1)
  return value === 'true' ? true : value === 'false' ? false : null
}

const writeSidebarStateCookie = (open: boolean) => {
  document.cookie =
    `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE_SECONDS}; samesite=lax`
}

function SidebarProvider({
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)
  const [open, setOpenState] = React.useState<boolean>(() => readSidebarStateCookie() ?? true)

  const setOpen = React.useCallback((next: boolean) => {
    setOpenState(next)
    writeSidebarStateCookie(next)
  }, [])

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((previous) => !previous)
      return
    }
    setOpen(!open)
  }, [isMobile, open, setOpen])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleSidebar])

  const value = React.useMemo(
    () => ({
      open,
      setOpen,
      openMobile,
      setOpenMobile,
      isMobile,
      state: (open ? 'expanded' : 'collapsed') as 'expanded' | 'collapsed',
      toggleSidebar,
    }),
    [open, setOpen, openMobile, isMobile, toggleSidebar],
  )

  return (
    <SidebarContext.Provider value={value}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            '--sidebar-width': SIDEBAR_WIDTH,
            '--sidebar-rail-width': SIDEBAR_RAIL_WIDTH,
            '--sidebar-transition': `${SIDEBAR_TRANSITION_MS}ms`,
            ...style,
          } as React.CSSProperties
        }
        className={cn('flex h-screen min-h-screen w-full overflow-hidden', className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

function Sidebar({ className, children, ...props }: React.ComponentProps<'div'>) {
  const { isMobile, openMobile, setOpenMobile, state } = useSidebar()

  if (isMobile) {
    return (
      <DialogPrimitive.Root open={openMobile} onOpenChange={setOpenMobile}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/45 backdrop-blur-[2px]" />
          <DialogPrimitive.Content
            data-slot="sidebar"
            data-mobile="true"
            style={{ width: SIDEBAR_WIDTH }}
            className={cn(
              'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground outline-none',
              // SPEC R1: translate3d + 180ms, prefers-reduced-motion 이면 transition 제거.
              'transform-[translate3d(0,0,0)] will-change-transform',
              '[transition:transform_var(--sidebar-transition)_ease-out]',
              'data-[state=closed]:transform-[translate3d(-100%,0,0)]',
              'motion-reduce:[transition:none]',
              className,
            )}
          >
            <DialogPrimitive.Title className="sr-only">LNB</DialogPrimitive.Title>
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    )
  }

  return (
    <div
      className="group peer hidden text-sidebar-foreground md:block"
      data-state={state}
      data-slot="sidebar-root"
    >
      {/* 본문을 밀어내는 자리(레이아웃 폭). 실제 패널은 fixed 라 이 요소가 폭을 담당한다. */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          'relative h-screen w-(--sidebar-width) bg-transparent',
          '[transition:width_var(--sidebar-transition)_ease-out] motion-reduce:[transition:none]',
          'group-data-[state=collapsed]:w-(--sidebar-rail-width)',
        )}
      />
      <div
        data-slot="sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden h-screen w-(--sidebar-width) md:flex',
          // SPEC R1: translate3d 로 합성 레이어에 올리고 폭 전환 180ms, reduced-motion 이면 제거.
          'transform-[translate3d(0,0,0)] will-change-transform',
          '[transition:width_var(--sidebar-transition)_ease-out]',
          'motion-reduce:[transition:none]',
          'group-data-[state=collapsed]:w-(--sidebar-rail-width)',
          className,
        )}
        {...props}
      >
        <div className="flex h-full w-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar shadow-[4px_0_20px_oklch(0_0_0/0.035)]">
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn(
        'flex shrink-0 flex-col gap-2 px-3 py-2.5',
        'group-data-[state=collapsed]:px-2',
        className,
      )}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        // hover-scroll: 평소에는 스크롤바를 숨기고 마우스를 올릴 때만 노출한다(index.css).
        'hover-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-3 py-4',
        'group-data-[state=collapsed]:gap-1 group-data-[state=collapsed]:px-2',
        className,
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn('relative flex w-full min-w-0 flex-col gap-1', className)}
      {...props}
    />
  )
}

/** 그룹 아코디언 헤더입니다 — 라벨 + 열림 상태를 나타내는 chevron(장식선 없음). */
function SidebarGroupButton({
  className,
  open,
  children,
  ...props
}: React.ComponentProps<'button'> & { open: boolean }) {
  return (
    <button
      type="button"
      data-slot="sidebar-group-button"
      aria-expanded={open}
      className={cn(
        'flex h-7 w-full shrink-0 items-center gap-2 rounded-md px-1 text-xs font-semibold tracking-wide text-sidebar-foreground/60 transition-colors',
        'hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        className,
      )}
      {...props}
    >
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      <ChevronDown
        aria-hidden="true"
        className={cn('size-3 shrink-0 transition-transform', open ? null : '-rotate-90')}
      />
    </button>
  )
}

/** 접힘 rail 의 정사각 아이콘 버튼입니다(그룹 1개 = 버튼 1개). */
function SidebarRailButton({
  className,
  isActive = false,
  ...props
}: React.ComponentProps<'button'> & { isActive?: boolean }) {
  return (
    <button
      type="button"
      data-slot="sidebar-rail-button"
      data-active={isActive}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center self-center rounded-lg transition-[color,background-color,box-shadow]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        isActive
          ? 'bg-sidebar-accent text-brand-accent shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--brand-primary)_18%,transparent)]'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
        className,
      )}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn(
        // 항목 왼쪽 안내선은 두지 않는다 — 들여쓰기(ml/pl)만으로 그룹 하위임을 나타낸다.
        'ml-1 flex w-auto min-w-0 flex-col gap-1 pl-1.5',
        className,
      )}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  )
}

/** LNB 항목 버튼입니다. */
function SidebarMenuButton({
  className,
  isActive = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  isActive?: boolean
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={cn(
        'flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-left text-sm font-medium transition-[color,background-color,box-shadow]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        isActive
          ? 'bg-sidebar-accent font-semibold text-brand-accent shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--brand-primary)_16%,transparent)]'
          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  )
}

/** LNB 항목의 라벨. */
function SidebarMenuLabel({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="sidebar-menu-label"
      className={cn('min-w-0 flex-1 truncate', className)}
      {...props}
    />
  )
}

/** LNB 옆 본문 영역. */
function SidebarInset({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-inset"
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background', className)}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupButton,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLabel,
  SidebarProvider,
  SidebarRailButton,
}
