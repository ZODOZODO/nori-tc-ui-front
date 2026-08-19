import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { useI18n } from '@/i18n/i18n-context'
import { isAppNavigationRouteActive, type AppNavigationGroup } from '@/shared/lib/app-navigation'
import { APP_NAVIGATION_ITEM_ICONS } from '@/shared/lib/app-navigation-icons'

interface AppLnbFlyoutProps {
  /** 표시할 그룹. `null` 이면 아무것도 렌더하지 않는다. */
  group: AppNavigationGroup | null
  /** 트리거(rail 버튼)의 화면 좌표 — 패널 위치와 caret 높이를 정한다. */
  rect: DOMRect | null
  /** 키보드·클릭으로 열렸을 때만 첫 항목에 포커스를 준다(hover 로 열렸을 때 포커스를 가로채지 않는다). */
  autoFocus: boolean
  pathname: string
  onNavigate: (route: string) => void
  onPointerEnter: () => void
  onPointerLeave: () => void
  onClose: () => void
}

/** 패널 상단을 트리거보다 살짝 올려 caret 이 아이콘 중앙을 가리키게 한다. */
const PANEL_TOP_OFFSET = 6
const CARET_HALF = 8

/**
 * 접힘 rail 의 그룹 하위 메뉴 플라이아웃입니다.
 *
 * <p>LNB 패널은 `overflow-hidden` 이라 그 안에서 띄우면 잘린다 — `document.body` 로 portal 해
 * 클리핑을 피한다. 열림/닫힘 지연(hover-intent)은 부모가 소유하고 이 컴포넌트는 표시와
 * Esc/포커스만 담당한다.</p>
 */
export function AppLnbFlyout({
  group,
  rect,
  autoFocus,
  pathname,
  onNavigate,
  onPointerEnter,
  onPointerLeave,
  onClose,
}: AppLnbFlyoutProps) {
  const { t } = useI18n()
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (group && rect && autoFocus) {
      panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus()
    }
  }, [group, rect, autoFocus])

  if (!group || !rect) {
    return null
  }

  const caretTop = rect.height / 2 + PANEL_TOP_OFFSET - CARET_HALF

  return createPortal(
    <div
      role="menu"
      aria-label={t('navigation.groupMenu', { group: t(group.labelKey) })}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
      // pl-3 = 트리거와 패널 사이의 투명 브릿지 — 마우스가 대각선으로 건너갈 때 닫히지 않게 한다.
      className="fixed z-[var(--z-dropdown)] pl-3"
      style={{ top: rect.top - PANEL_TOP_OFFSET, left: rect.right }}
      data-testid="lnb-flyout"
    >
      <div
        ref={panelRef}
        className="relative min-w-48 rounded-xl border border-border bg-popover p-1.5 shadow-soft-lg"
      >
        {/* caret 2겹 — 아래가 테두리, 위가 면. 색은 패널과 같은 토큰을 따른다. */}
        <span
          aria-hidden="true"
          className="absolute h-0 w-0"
          style={{
            top: caretTop - 1,
            left: -9,
            borderStyle: 'solid',
            borderWidth: '9px 9px 9px 0',
            borderColor: 'transparent var(--border) transparent transparent',
          }}
        />
        <span
          aria-hidden="true"
          className="absolute h-0 w-0"
          style={{
            top: caretTop,
            left: -8,
            borderStyle: 'solid',
            borderWidth: '8px 8px 8px 0',
            borderColor: 'transparent var(--popover) transparent transparent',
          }}
        />
        <div className="px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-muted-foreground">
          {t(group.labelKey)}
        </div>
        {group.items.map((item) => {
          const Icon = APP_NAVIGATION_ITEM_ICONS[item.key]
          const active = isAppNavigationRouteActive(pathname, item.route)
          return (
            <Link
              key={item.key}
              to={item.route}
              role="menuitem"
              aria-current={active ? 'page' : undefined}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return
                }
                event.preventDefault()
                onNavigate(item.route)
              }}
              className={
                active
                  ? 'flex items-center gap-2 rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-semibold text-brand-accent'
                  : 'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-popover-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground'
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
