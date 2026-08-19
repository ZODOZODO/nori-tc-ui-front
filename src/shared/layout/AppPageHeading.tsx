import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useI18n } from '@/i18n/i18n-context'
import { resolveAppNavigationLocation } from '@/shared/lib/app-navigation'
import { APP_NAVIGATION_ITEM_ICONS } from '@/shared/lib/app-navigation-icons'
import { PageHeading } from './PageHeading'
import { PageHeadingWithActions } from './PageHeadingWithActions'

interface AppPageHeadingProps {
  /**
   * 페이지 제목 (h1). 생략하면 현재 경로의 LNB 항목 라벨을 그대로 쓴다.
   *
   * 라우트 페이지는 대개 생략한다 — 제목을 페이지가 따로 소유하면 LNB 라벨과 갈라지고,
   * 갈라진 뒤에는 어느 쪽이 맞는지 코드를 열어야 알 수 있다.
   */
  name?: string
  /** 제목 아래 보조 설명 — 이 화면이 무엇을 하는지 한 문장. */
  description?: string
  /** 총건수 pill. */
  total?: number
  /** 우측 정렬 액션 영역. 있으면 actions 변형으로 렌더한다. */
  actions?: ReactNode
  className?: string
}

/**
 * 라우트 페이지의 제목 블록입니다 — 아이콘은 현재 경로의 LNB 항목에서 그대로 끌어온다.
 *
 * <p>모든 라우트 페이지가 이 컴포넌트를 쓴다. 아이콘을 prop 으로 받지 않으므로 사이드바 아이콘과
 * 페이지 아이콘이 갈라질 수 없다. LNB 에 없는 경로(DEV fixture 등)는 아이콘 없이 제목만 나온다.</p>
 *
 * <p>제목/설명이 화면 상태에 따라 바뀌는 in-page 섹션 헤딩은 이 컴포넌트가 아니라
 * {@link PageHeading} / {@link PageHeadingWithActions} 를 직접 쓴다(아이콘 없음).</p>
 */
export function AppPageHeading({
  name,
  description,
  total,
  actions,
  className,
}: AppPageHeadingProps) {
  const { t } = useI18n()
  const location = useLocation()
  const navigationLocation = resolveAppNavigationLocation(location.pathname)
  const Icon = navigationLocation ? APP_NAVIGATION_ITEM_ICONS[navigationLocation.item.key] : null
  const icon = Icon ? <Icon aria-hidden="true" /> : undefined
  const resolvedName = name ?? (navigationLocation ? t(navigationLocation.item.labelKey) : null)

  // 제목을 못 정하는 경로(LNB 밖 + name 미지정)는 빈 h1 을 그리지 않는다.
  if (resolvedName === null) {
    return null
  }

  return actions ? (
    <PageHeadingWithActions
      icon={icon}
      name={resolvedName}
      description={description}
      total={total}
      actions={actions}
      className={className}
    />
  ) : (
    <PageHeading
      icon={icon}
      name={resolvedName}
      description={description}
      total={total}
      className={className}
    />
  )
}
