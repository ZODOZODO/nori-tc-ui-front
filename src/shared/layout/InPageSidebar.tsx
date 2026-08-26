import type { ReactNode } from 'react'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { SidebarResizeHandle } from '@/components/ui/sidebar-resize-handle'
import { cn } from '@/lib/utils'
import { LNB_FOCUS_RING } from './lnb-sidebar'

interface InPageSidebarProps {
  /** 펼침 상태의 머리글 제목. */
  title: string
  open: boolean
  /** 현재 폭(px) — 펼침·접힘 모두 호출부 store 가 소유한다. */
  width: number
  /** 접힘 토글 버튼의 aria-label(펼치기). */
  expandLabel: string
  /** 접힘 토글 버튼의 aria-label(접기). */
  collapseLabel: string
  onToggle: () => void
  onResize: (deltaX: number) => void
  /** 펼침 상태의 본문(검색·내비 트리 등). */
  children: ReactNode
}

/**
 * 페이지 안 2차 내비 사이드바의 공용 껍데기입니다(설비 / 모델).
 *
 * <p>담는 내용은 화면마다 다르지만 <b>껍데기는 같아야 한다</b> — 표면·머리글·접기 토글·폭 드래그가
 * 화면마다 달라지면 같은 앱에서 사이드바가 여러 종류로 읽힌다. 전역 LNB 와도 조작 언어를 맞춘다:
 * 접기 토글은 같은 더블 chevron 이고(테두리 없는 아이콘 버튼), 폭 전환도 같은 180ms 다.</p>
 *
 * <p>표면은 전역 LNB 의 {@code bg-sidebar} 가 아니라 {@code bg-card} 를 유지한다 — 이 패널은
 * {@code SidebarInset} 안에 들어가는 페이지 소유 패널이라, 같은 색을 쓰면 1차 내비와 2차 내비의
 * 위계 구분이 사라진다.</p>
 */
export function InPageSidebar({
  title,
  open,
  width,
  expandLabel,
  collapseLabel,
  onToggle,
  onResize,
  children,
}: InPageSidebarProps) {
  // 전역 LNB 토글과 같은 모양의 아이콘 버튼 — 테두리 없이 hover 면만 든다.
  const toggleButton = (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? collapseLabel : expandLabel}
      aria-expanded={open}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        LNB_FOCUS_RING,
      )}
    >
      {open ? (
        <ChevronsLeft className="size-4" aria-hidden="true" />
      ) : (
        <ChevronsRight className="size-4" aria-hidden="true" />
      )}
    </button>
  )

  return (
    <aside
      className={cn(
        'flex flex-col self-stretch border-r border-border bg-card',
        // 전역 LNB 와 같은 폭 전환. reduced-motion 이면 전역 LNB 처럼 전환을 없앤다.
        '[transition:width_var(--sidebar-transition,180ms)_ease-out] motion-reduce:[transition:none]',
      )}
      style={{ width: `${width}px` }}
    >
      {open ? (
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-13 items-center justify-between gap-2 px-3">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {title}
              </span>
              {toggleButton}
            </div>
            {children}
          </div>

          <SidebarResizeHandle onDrag={onResize} />
        </div>
      ) : (
        <div className="flex h-13 items-center justify-center">{toggleButton}</div>
      )}
    </aside>
  )
}
