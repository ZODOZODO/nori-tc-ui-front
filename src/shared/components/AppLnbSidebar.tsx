import { startTransition, useCallback, useRef, useState, type MouseEvent } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import noriTcLogoUrl from '@/assets/brand/nori-tc-logo.png'
import { preloadRouteModule } from '@/app/route-modules'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupButton,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuLabel,
  SidebarRailButton,
} from '@/components/ui/sidebar'
import { useSidebar } from '@/components/ui/sidebar-context'
import { dlqApi } from '@/features/dlq/api/dlq.api'
import { eqpApi } from '@/features/eqp/api/eqp.api'
import { eqpQueryKeys } from '@/features/eqp/lib/eqp-query-keys'
import { groupApi } from '@/features/group/api/group.api'
import { GROUP_PAGE_SIZE } from '@/features/group/components/GroupListTable'
import { groupQueryKeys } from '@/features/group/lib/group-query-keys'
import { liveMapApi } from '@/features/live-map/api/live-map.api'
import { modelApi } from '@/features/model/api/model.api'
import { modelQueryKeys } from '@/features/model/lib/model-query-keys'
import { useMe } from '@/features/profile/hooks/useProfile'
import { userApi } from '@/features/user/api/user.api'
import { USER_PAGE_SIZE } from '@/features/user/components/UserListTable'
import { userQueryKeys } from '@/features/user/lib/user-query-keys'
import { useI18n } from '@/i18n/i18n-context'
import {
  isAppNavigationRouteActive,
  resolveVisibleAppNavigationGroups,
  type AppNavigationGroup,
  type AppNavigationGroupKey,
  type AppNavigationItemKey,
} from '@/shared/lib/app-navigation'
import {
  APP_NAVIGATION_GROUP_ICONS,
  APP_NAVIGATION_ITEM_ICONS,
} from '@/shared/lib/app-navigation-icons'
import { AppLnbFlyout } from './AppLnbFlyout'

/** 트리거 ↔ 플라이아웃 대각선 이동 중 깜빡임을 막는 닫힘 지연(ms). */
const FLYOUT_CLOSE_DELAY_MS = 180

interface FlyoutState {
  group: AppNavigationGroup
  rect: DOMRect
  autoFocus: boolean
}

/**
 * LNB 항목에 마우스를 올렸을 때 그 화면이 첫 mount 에서 자동 호출하는 query 를 미리 fetch 합니다.
 *
 * <p>queryKey / queryFn / staleTime 이 각 hook 정의와 정확히 일치해야 cache hit 가 난다 —
 * 하나라도 어긋나면 prefetch 는 네트워크만 한 번 더 쓰고 버려진다.</p>
 *
 * <p>deploy 3 항목은 제외한다: mode/filter 분기로 정적 query 가 없다(구 topbar 제외 사유 승계).
 * user 계열의 listOffset 은 0 가정이라 사용자가 페이지를 넘긴 상태에서는 prefetch miss 다.</p>
 */
const prefetchByItemKey = (queryClient: QueryClient, key: AppNavigationItemKey): void => {
  switch (key) {
    case 'liveMap':
      void queryClient.prefetchQuery({
        queryKey: ['live-map'],
        queryFn: () => liveMapApi.getLiveMap(),
        staleTime: 5_000,
      })
      return
    case 'dlqDashboard':
      // DashboardPanel 은 자체 query 가 없고 gateway/business/quarantine/repair-task 4 종을
      // 그대로 mount 해 집계한다(DashboardPanel.tsx:168-171) → 4 종을 함께 받는다.
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'gateway'],
        queryFn: dlqApi.fetchGatewayDlq,
        staleTime: 30_000,
      })
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'business'],
        queryFn: dlqApi.fetchBusinessDlq,
        staleTime: 30_000,
      })
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'quarantine'],
        queryFn: dlqApi.fetchQuarantine,
        staleTime: 30_000,
      })
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'repair-task'],
        queryFn: dlqApi.fetchRepairTasks,
        staleTime: 30_000,
      })
      return
    case 'dlqGateway':
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'gateway'],
        queryFn: dlqApi.fetchGatewayDlq,
        staleTime: 30_000,
      })
      return
    case 'dlqBusiness':
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'business'],
        queryFn: dlqApi.fetchBusinessDlq,
        staleTime: 30_000,
      })
      return
    case 'dlqQuarantine':
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'quarantine'],
        queryFn: dlqApi.fetchQuarantine,
        staleTime: 30_000,
      })
      return
    case 'dlqRepairTask':
      void queryClient.prefetchQuery({
        queryKey: ['dlq', 'repair-task'],
        queryFn: dlqApi.fetchRepairTasks,
        staleTime: 30_000,
      })
      return
    case 'eqpBusiness':
    case 'eqpGateway':
      void queryClient.prefetchQuery({
        queryKey: eqpQueryKeys.list(),
        queryFn: () => eqpApi.getEqpList(0, 500),
        staleTime: 60_000,
      })
      return
    case 'modelSecs':
    case 'modelSocket':
    case 'modelPlc':
      void queryClient.prefetchQuery({
        queryKey: modelQueryKeys.list(),
        queryFn: () => modelApi.getModelList(0, 500),
        staleTime: 60_000,
      })
      return
    case 'userUsers':
      void queryClient.prefetchQuery({
        queryKey: userQueryKeys.list(0, USER_PAGE_SIZE),
        queryFn: () => userApi.getUserList(0, USER_PAGE_SIZE),
        staleTime: 30_000,
      })
      return
    case 'userGroups':
      void queryClient.prefetchQuery({
        queryKey: groupQueryKeys.list(0, GROUP_PAGE_SIZE),
        queryFn: () => groupApi.getGroupList(0, GROUP_PAGE_SIZE),
        staleTime: 30_000,
      })
      return
    case 'deployRegister':
    case 'deployDeploy':
    case 'deployHistory':
      return
  }
}

/**
 * 앱 1차 내비게이션 좌측 LNB 입니다(SPEC R4).
 *
 * <p>2단 그룹(모니터링 / 처리실패 / 설비 / 모델 / 적용 / 시스템)을 권한으로 필터링해 표시한다.
 * 펼침은 그룹 아코디언 + 항목 아이콘이고, 접힘은 56px rail 로 그룹 아이콘만 남기고 hover·클릭 시
 * 플라이아웃으로 그 그룹의 항목을 띄운다 — 접어도 이동 수단이 사라지지 않는다. 도메인 내부
 * 사이드바(Eqp/Model 트리)는 이 LNB 와 별개인 in-page 2차 내비로 유지된다.</p>
 */
export function AppLnbSidebar() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQuery = useMe(true)
  const { isMobile, state, toggleSidebar, setOpenMobile } = useSidebar()
  const groups = resolveVisibleAppNavigationGroups(meQuery.data?.permissionCodes)
  // 접힘(rail)은 데스크톱 전용이다 — 모바일은 off-canvas 로 항상 펼친 모습이다.
  const isRail = !isMobile && state === 'collapsed'

  // 닫아 둔 그룹만 기억한다 — 기본값이 "전부 펼침"이라 새 그룹이 생겨도 자동으로 보인다.
  const [closedGroupKeys, setClosedGroupKeys] = useState<readonly AppNavigationGroupKey[]>([])
  const toggleGroup = (key: AppNavigationGroupKey) => {
    setClosedGroupKeys((previous) =>
      previous.includes(key) ? previous.filter((entry) => entry !== key) : [...previous, key],
    )
  }

  const [flyout, setFlyout] = useState<FlyoutState | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => setFlyout(null), FLYOUT_CLOSE_DELAY_MS)
  }, [cancelClose])

  const openFlyout = (group: AppNavigationGroup, trigger: HTMLElement, autoFocus: boolean) => {
    cancelClose()
    triggerRef.current = trigger
    setFlyout({ group, rect: trigger.getBoundingClientRect(), autoFocus })
  }

  const closeFlyout = (returnFocus: boolean) => {
    cancelClose()
    setFlyout(null)
    if (returnFocus) {
      triggerRef.current?.focus()
    }
  }

  const goTo = (route: string) => {
    if (isMobile) {
      setOpenMobile(false)
    }
    if (!isAppNavigationRouteActive(location.pathname, route)) {
      // lazy 모듈이 아직 도착하지 않아도 기존 페이지와 앱 셸을 유지한 채 전환합니다.
      startTransition(() => navigate(route))
    }
  }

  const handleNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    route: string,
    active: boolean,
  ) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    event.preventDefault()
    if (isMobile) {
      setOpenMobile(false)
    }
    if (!active) {
      startTransition(() => navigate(route))
    }
  }

  /** 라우트 청크와 그 화면의 첫 query 를 함께 미리 받는다. */
  const preload = (route: string, key: AppNavigationItemKey) => {
    void preloadRouteModule(route).catch(() => undefined)
    prefetchByItemKey(queryClient, key)
  }

  return (
    <Sidebar>
      <SidebarHeader>
        {/* 토글 버튼은 펼침·접힘 모두 사이드바 오른쪽 끝에 붙는다(로고가 남는 폭을 차지). */}
        <div className="flex h-9.5 items-center justify-end gap-2">
          {isRail ? null : (
            <img src={noriTcLogoUrl} alt="Nori-TC" className="mr-auto h-8 w-auto" />
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isRail ? t('navigation.expand') : t('navigation.collapse')}
            aria-expanded={!isRail}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring"
          >
            {isRail ? (
              <ChevronsRight className="size-4" aria-hidden="true" />
            ) : (
              <ChevronsLeft className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent
        aria-label={t('navigation.main')}
        onScroll={() => {
          if (flyout) {
            closeFlyout(false)
          }
        }}
      >
        {groups.map((group) => {
          if (isRail) {
            const GroupIcon = APP_NAVIGATION_GROUP_ICONS[group.key]
            const open = flyout?.group.key === group.key
            const hasActiveItem = group.items.some((item) =>
              isAppNavigationRouteActive(location.pathname, item.route),
            )
            return (
              <SidebarRailButton
                key={group.key}
                isActive={open || hasActiveItem}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={t(group.labelKey)}
                title={t(group.labelKey)}
                onClick={(event) =>
                  open ? closeFlyout(false) : openFlyout(group, event.currentTarget, true)
                }
                onPointerEnter={(event) => openFlyout(group, event.currentTarget, false)}
                onPointerLeave={scheduleClose}
                onFocus={() => group.items.forEach((item) => preload(item.route, item.key))}
              >
                <GroupIcon className="size-4.5" aria-hidden="true" />
              </SidebarRailButton>
            )
          }

          const open = !closedGroupKeys.includes(group.key)
          return (
            <SidebarGroup key={group.key}>
              <SidebarGroupButton open={open} onClick={() => toggleGroup(group.key)}>
                {t(group.labelKey)}
              </SidebarGroupButton>
              {open ? (
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = APP_NAVIGATION_ITEM_ICONS[item.key]
                    const active = isAppNavigationRouteActive(location.pathname, item.route)
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link
                            to={item.route}
                            data-testid={`lnb-item-${item.key}`}
                            aria-current={active ? 'page' : undefined}
                            onPointerEnter={() => preload(item.route, item.key)}
                            onFocus={() => preload(item.route, item.key)}
                            onTouchStart={() => preload(item.route, item.key)}
                            onClick={(event) => handleNavigation(event, item.route, active)}
                          >
                            <Icon className="size-4 shrink-0" aria-hidden="true" />
                            <SidebarMenuLabel>{t(item.labelKey)}</SidebarMenuLabel>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              ) : null}
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      {isRail ? (
        <AppLnbFlyout
          group={flyout?.group ?? null}
          rect={flyout?.rect ?? null}
          autoFocus={flyout?.autoFocus ?? false}
          pathname={location.pathname}
          onNavigate={(route) => {
            goTo(route)
            closeFlyout(false)
          }}
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
          onClose={() => closeFlyout(true)}
        />
      ) : null}
    </Sidebar>
  )
}
