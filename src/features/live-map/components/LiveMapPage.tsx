import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/i18n/i18n-context'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { clearDeployUiSessionState } from '@/features/deploy/stores/deploy-ui.store'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { LiveMapBoard } from './LiveMapBoard'
import { LiveMapHeader } from './LiveMapHeader'

// 사용자가 "데모" 버튼 누른 시점에만 mount. 568 LOC 모달이라 페이지 초기 청크에서 제외.
const LiveMapDemoModal = lazy(() =>
  import('./LiveMapDemoModal').then((module) => ({ default: module.LiveMapDemoModal })),
)
import {
  applyLiveMapClusterPositionDrafts,
  applyLiveMapEquipmentPositionDrafts,
} from '../lib/live-map-layout'
import {
  LIVE_MAP_CLUSTER_ITEMS,
  LIVE_MAP_STATE_OPTIONS,
} from '../mocks/live-map.mock'
import {
  filterLiveMapEquipmentNodes,
  formatLiveMapSyncLabel,
  resolveSelectedLiveMapEquipment,
  summarizeLiveMapEquipmentNodes,
} from '../lib/live-map-selectors'
import { buildLiveMapEquipmentNodes } from '../lib/live-map-data'
import { useLiveMap } from '../hooks/useLiveMap'
import { useLiveMapUiStore } from '../stores/live-map-ui.store'
import { useLineScopeStore } from '@/shared/stores/line-scope.store'

export function LiveMapPage() {
  const { t } = useI18n()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)
  // 상세 패널 닫기(X) — resolver 가 selectedEqpId=null 일 때 ERROR 설비로 자동 폴백하므로,
  // "사용자가 명시적으로 닫음" 을 별도 플래그로 구분해 폴백 복귀를 막는다.
  const [isDetailDismissed, setIsDetailDismissed] = useState(false)

  const searchKeyword = useLiveMapUiStore((state) => state.searchKeyword)
  const selectedStatus = useLiveMapUiStore((state) => state.selectedStatus)
  const selectedEqpId = useLiveMapUiStore((state) => state.selectedEqpId)
  const isLayoutEditEnabled = useLiveMapUiStore((state) => state.isLayoutEditEnabled)
  const clusterPositionDrafts = useLiveMapUiStore((state) => state.clusterPositionDrafts)
  const equipmentPositionDrafts = useLiveMapUiStore((state) => state.equipmentPositionDrafts)
  const zoomLevel = useLiveMapUiStore((state) => state.zoomLevel)
  const lastSyncAt = useLiveMapUiStore((state) => state.lastSyncAt)
  const [now, setNow] = useState(lastSyncAt)
  const setSearchKeyword = useLiveMapUiStore((state) => state.setSearchKeyword)
  const setSelectedStatus = useLiveMapUiStore((state) => state.setSelectedStatus)
  const setSelectedEqpId = useLiveMapUiStore((state) => state.setSelectedEqpId)
  const setLayoutEditEnabled = useLiveMapUiStore((state) => state.setLayoutEditEnabled)
  const updateClusterLayout = useLiveMapUiStore((state) => state.updateClusterLayout)
  const zoomIn = useLiveMapUiStore((state) => state.zoomIn)
  const zoomOut = useLiveMapUiStore((state) => state.zoomOut)
  const resetZoom = useLiveMapUiStore((state) => state.resetZoom)
  const markSynced = useLiveMapUiStore((state) => state.markSynced)
  const reset = useLiveMapUiStore((state) => state.reset)
  const liveMapQuery = useLiveMap()
  const selectedLineValue = useLineScopeStore((state) => state.selectedLineValue)

  const deferredSearchKeyword = useDeferredValue(searchKeyword)

  const clusterItems = useMemo(
    () =>
      applyLiveMapClusterPositionDrafts(
        LIVE_MAP_CLUSTER_ITEMS,
        clusterPositionDrafts,
      ),
    [clusterPositionDrafts],
  )

  const equipmentNodes = useMemo(
    () =>
      applyLiveMapEquipmentPositionDrafts(
        buildLiveMapEquipmentNodes(
          liveMapQuery.data?.equipmentItems ?? [],
          clusterItems,
        ),
        equipmentPositionDrafts,
      ),
    [clusterItems, equipmentPositionDrafts, liveMapQuery.data?.equipmentItems],
  )

  const visibleEquipmentNodes = useMemo(
    () =>
      filterLiveMapEquipmentNodes(equipmentNodes, {
        statusFilter: selectedStatus,
        searchKeyword: deferredSearchKeyword,
        lineFilter: selectedLineValue,
      }),
    [deferredSearchKeyword, equipmentNodes, selectedStatus, selectedLineValue],
  )

  const summary = useMemo(
    () => summarizeLiveMapEquipmentNodes(visibleEquipmentNodes),
    [visibleEquipmentNodes],
  )

  const selectedEquipment = useMemo(
    () =>
      resolveSelectedLiveMapEquipment(
        equipmentNodes,
        visibleEquipmentNodes,
        selectedEqpId,
      ),
    [equipmentNodes, selectedEqpId, visibleEquipmentNodes],
  )

  // 사용자가 X 로 닫았으면 폴백 설비를 표시하지 않는다.
  const displayedEquipment = isDetailDismissed ? null : selectedEquipment

  const handleSelectEquipment = (eqpId: string) => {
    setIsDetailDismissed(false)
    setSelectedEqpId(eqpId)
  }

  const handleClearSelection = () => {
    setIsDetailDismissed(true)
  }

  const visibleEquipmentIds = useMemo(
    () => new Set(visibleEquipmentNodes.map((item) => item.eqpId)),
    [visibleEquipmentNodes],
  )

  const syncLabel = useMemo(
    () => formatLiveMapSyncLabel(lastSyncAt, now),
    [lastSyncAt, now],
  )

  useEffect(() => {
    return () => {
      reset()
    }
  }, [reset])

  useEffect(() => {
    if (selectedEquipment?.eqpId !== selectedEqpId) {
      setSelectedEqpId(selectedEquipment?.eqpId ?? null)
    }
  }, [selectedEquipment?.eqpId, selectedEqpId, setSelectedEqpId])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

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
              {liveMapQuery.error instanceof Error
                ? liveMapQuery.error.message
                : t('livemap.error')}
            </div>
          ) : null}
          <LiveMapBoard
            clusters={clusterItems}
            syncLabel={syncLabel}
            searchKeyword={searchKeyword}
            selectedStatus={selectedStatus}
            stateOptions={LIVE_MAP_STATE_OPTIONS}
            onSearchKeywordChange={setSearchKeyword}
            onSelectedStatusChange={setSelectedStatus}
            equipmentNodes={equipmentNodes}
            visibleEquipmentIds={visibleEquipmentIds}
            selectedEquipment={displayedEquipment}
            zoomLevel={zoomLevel}
            isLayoutEditEnabled={isLayoutEditEnabled}
            onSelectEquipment={handleSelectEquipment}
            onClearSelection={handleClearSelection}
            onOpenDemo={() => setIsDemoModalOpen(true)}
            onLayoutEditEnabledChange={setLayoutEditEnabled}
            onMoveCluster={(clusterId, position) => updateClusterLayout(clusterId, position, {})}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onResetZoom={resetZoom}
          />
          {liveMapQuery.isLoading && equipmentNodes.length === 0 ? (
            <div className="rounded-[18px] border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground">
              {t('livemap.loading')}
            </div>
          ) : null}
        </div>
      </main>

      <UserProfileModal open={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      {isDemoModalOpen && (
        <Suspense fallback={null}>
          <LiveMapDemoModal
            open
            equipmentNodes={equipmentNodes}
            clusterItems={clusterItems}
            onClose={() => setIsDemoModalOpen(false)}
          />
        </Suspense>
      )}
    </AppPageShell>
  )
}
