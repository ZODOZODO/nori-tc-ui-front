import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/i18n/i18n-context'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { clearDeployUiSessionState } from '@/features/deploy/stores/deploy-ui.store'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { useLineScopeStore } from '@/shared/stores/line-scope.store'
import { LiveMapHeader } from './LiveMapHeader'
import { LiveMapLayoutCanvas } from './LiveMapLayoutCanvas'

// 사용자가 "데모" 버튼 누른 시점에만 mount. 568 LOC 모달이라 페이지 초기 청크에서 제외.
const LiveMapDemoModal = lazy(() =>
  import('./LiveMapDemoModal').then((module) => ({ default: module.LiveMapDemoModal })),
)
import { LIVE_MAP_CLUSTER_ITEMS } from '../mocks/live-map.mock'
import {
  filterLiveMapEquipmentNodes,
  summarizeLiveMapEquipmentNodes,
} from '../lib/live-map-selectors'
import { buildLiveMapEquipmentNodes } from '../lib/live-map-data'
import { useLiveMap } from '../hooks/useLiveMap'
import { useLiveMapUiStore } from '../stores/live-map-ui.store'

/**
 * live-map 페이지(Phase 2): 상단 KPI 헤더 + react-konva 2.5D 레이아웃 빌더 캔버스.
 *
 * <p>cluster polygon 캔버스(LiveMapBoard)는 폐기되고 {@link LiveMapLayoutCanvas} 가 캔버스를 담당한다.
 * KPI 요약/데모 테스터는 보존한다(데모 테스터는 설비 그룹 입력으로 cluster 메타를 계속 사용).</p>
 */
export function LiveMapPage() {
  const { t } = useI18n()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)

  const liveMapQuery = useLiveMap()
  const selectedLineValue = useLineScopeStore((state) => state.selectedLineValue)
  const markSynced = useLiveMapUiStore((state) => state.markSynced)
  const reset = useLiveMapUiStore((state) => state.reset)

  const equipmentNodes = useMemo(
    () => buildLiveMapEquipmentNodes(liveMapQuery.data?.equipmentItems ?? [], LIVE_MAP_CLUSTER_ITEMS),
    [liveMapQuery.data?.equipmentItems],
  )

  const visibleEquipmentNodes = useMemo(
    () =>
      filterLiveMapEquipmentNodes(equipmentNodes, {
        statusFilter: 'ALL',
        searchKeyword: '',
        lineFilter: selectedLineValue,
      }),
    [equipmentNodes, selectedLineValue],
  )

  const summary = useMemo(
    () => summarizeLiveMapEquipmentNodes(visibleEquipmentNodes),
    [visibleEquipmentNodes],
  )

  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  useEffect(() => {
    if (liveMapQuery.dataUpdatedAt > 0) {
      markSynced(liveMapQuery.dataUpdatedAt)
    }
  }, [liveMapQuery.dataUpdatedAt, markSynced])

  const handleAfterLogout = () => {
    clearDeployUiSessionState()
    setIsProfileModalOpen(false)
    reset()
  }

  return (
    <AppPageShell
      currentMenu="dash"
      onOpenProfile={() => setIsProfileModalOpen(true)}
      onAfterLogout={handleAfterLogout}
    >
      <main className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="flex w-full flex-col gap-4 px-6 py-6">
          <LiveMapHeader summary={summary} />
          {liveMapQuery.isError ? (
            <div className="rounded-[18px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {liveMapQuery.error instanceof Error ? liveMapQuery.error.message : t('livemap.error')}
            </div>
          ) : null}
          <div className="flex justify-end">
            <button
              type="button"
              data-testid="live-map-open-demo"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
              onClick={() => setIsDemoModalOpen(true)}
            >
              Demo Tester
            </button>
          </div>
          <LiveMapLayoutCanvas />
        </div>
      </main>

      <UserProfileModal open={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      {isDemoModalOpen && (
        <Suspense fallback={null}>
          <LiveMapDemoModal
            open
            equipmentNodes={equipmentNodes}
            clusterItems={LIVE_MAP_CLUSTER_ITEMS}
            onClose={() => setIsDemoModalOpen(false)}
          />
        </Suspense>
      )}
    </AppPageShell>
  )
}
