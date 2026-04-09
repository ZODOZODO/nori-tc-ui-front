import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { clearDeployUiSessionState } from '@/features/deploy/stores/deploy-ui.store'
import { AppTopBar } from '@/shared/components/AppTopBar'
import { LiveMapBoard } from './LiveMapBoard'
import { LiveMapDemoModal } from './LiveMapDemoModal'
import { LiveMapHeader } from './LiveMapHeader'
import { LiveMapToolbar } from './LiveMapToolbar'
import {
  applyLiveMapClusterPositionDrafts,
  applyLiveMapEquipmentPositionDrafts,
} from '../lib/live-map-layout'
import {
  LIVE_MAP_CLUSTER_ITEMS,
  LIVE_MAP_LINE_OPTIONS,
  LIVE_MAP_STATE_OPTIONS,
} from '../mocks/live-map.mock'
import {
  filterLiveMapEquipmentNodes,
  formatLiveMapSyncLabel,
  resolveSelectedLiveMapEquipment,
  summarizeLiveMapEquipmentNodes,
  summarizeLiveMapEquipmentNodesByCluster,
} from '../lib/live-map-selectors'
import { buildLiveMapEquipmentNodes } from '../lib/live-map-data'
import { useLiveMap } from '../hooks/useLiveMap'
import { useLiveMapUiStore } from '../stores/live-map-ui.store'

export function LiveMapPage() {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)

  const searchKeyword = useLiveMapUiStore((state) => state.searchKeyword)
  const selectedLine = useLiveMapUiStore((state) => state.selectedLine)
  const selectedStatus = useLiveMapUiStore((state) => state.selectedStatus)
  const selectedEqpId = useLiveMapUiStore((state) => state.selectedEqpId)
  const isLayoutEditEnabled = useLiveMapUiStore((state) => state.isLayoutEditEnabled)
  const clusterPositionDrafts = useLiveMapUiStore((state) => state.clusterPositionDrafts)
  const equipmentPositionDrafts = useLiveMapUiStore((state) => state.equipmentPositionDrafts)
  const zoomLevel = useLiveMapUiStore((state) => state.zoomLevel)
  const lastSyncAt = useLiveMapUiStore((state) => state.lastSyncAt)
  const [now, setNow] = useState(lastSyncAt)
  const setSearchKeyword = useLiveMapUiStore((state) => state.setSearchKeyword)
  const setSelectedLine = useLiveMapUiStore((state) => state.setSelectedLine)
  const setSelectedStatus = useLiveMapUiStore((state) => state.setSelectedStatus)
  const setSelectedEqpId = useLiveMapUiStore((state) => state.setSelectedEqpId)
  const setLayoutEditEnabled = useLiveMapUiStore((state) => state.setLayoutEditEnabled)
  const updateClusterLayout = useLiveMapUiStore((state) => state.updateClusterLayout)
  const updateEquipmentPosition = useLiveMapUiStore((state) => state.updateEquipmentPosition)
  const zoomIn = useLiveMapUiStore((state) => state.zoomIn)
  const zoomOut = useLiveMapUiStore((state) => state.zoomOut)
  const resetZoom = useLiveMapUiStore((state) => state.resetZoom)
  const markSynced = useLiveMapUiStore((state) => state.markSynced)
  const reset = useLiveMapUiStore((state) => state.reset)
  const liveMapQuery = useLiveMap()

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
        lineValue: selectedLine,
        statusFilter: selectedStatus,
        searchKeyword: deferredSearchKeyword,
      }),
    [deferredSearchKeyword, equipmentNodes, selectedLine, selectedStatus],
  )

  const summary = useMemo(
    () => summarizeLiveMapEquipmentNodes(visibleEquipmentNodes),
    [visibleEquipmentNodes],
  )

  const clusterSummaries = useMemo(
    () => summarizeLiveMapEquipmentNodesByCluster(equipmentNodes),
    [equipmentNodes],
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
    <div className="flex min-h-screen min-w-0 flex-col bg-[#F7FAF8]">
      <AppTopBar
        currentMenu="dash"
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onAfterLogout={handleAfterLogout}
      />
      <div className="h-px bg-[#E5ECE7]" />

      <main className="flex-1 overflow-y-auto">
        <div className="flex w-full flex-col gap-4 px-6 py-6">
          <LiveMapHeader summary={summary} />
          <LiveMapToolbar
            searchKeyword={searchKeyword}
            selectedLine={selectedLine}
            selectedStatus={selectedStatus}
            lineOptions={LIVE_MAP_LINE_OPTIONS}
            stateOptions={LIVE_MAP_STATE_OPTIONS}
            onSearchKeywordChange={setSearchKeyword}
            onSelectedLineChange={setSelectedLine}
            onSelectedStatusChange={setSelectedStatus}
          />
          {liveMapQuery.isError ? (
            <div className="rounded-[18px] border border-[#F1C0C0] bg-[#FFF5F5] px-4 py-3 text-sm font-semibold text-[#A63A3A]">
              {liveMapQuery.error instanceof Error
                ? liveMapQuery.error.message
                : '라이브 맵 정보를 조회하지 못했습니다.'}
            </div>
          ) : null}
          <LiveMapBoard
            clusters={clusterItems}
            equipmentNodes={equipmentNodes}
            visibleEquipmentIds={visibleEquipmentIds}
            selectedEquipment={selectedEquipment}
            clusterSummaries={clusterSummaries}
            zoomLevel={zoomLevel}
            syncLabel={syncLabel}
            isLayoutEditEnabled={isLayoutEditEnabled}
            onSelectEquipment={setSelectedEqpId}
            onOpenDemo={() => setIsDemoModalOpen(true)}
            onLayoutEditEnabledChange={setLayoutEditEnabled}
            onMoveClusterLayout={updateClusterLayout}
            onMoveEquipment={updateEquipmentPosition}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onResetZoom={resetZoom}
          />
          {liveMapQuery.isLoading && equipmentNodes.length === 0 ? (
            <div className="rounded-[18px] border border-[#D9E3DC] bg-white px-4 py-3 text-sm font-semibold text-[#51606A]">
              라이브 맵 설비 정보를 불러오는 중입니다.
            </div>
          ) : null}
        </div>
      </main>

      <UserProfileModal open={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      <LiveMapDemoModal
        open={isDemoModalOpen}
        equipmentNodes={equipmentNodes}
        clusterItems={clusterItems}
        onClose={() => setIsDemoModalOpen(false)}
      />
    </div>
  )
}
