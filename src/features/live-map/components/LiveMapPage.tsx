import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/i18n/i18n-context'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { useMe } from '@/features/profile/hooks/useProfile'
import { clearDeployUiSessionState } from '@/features/deploy/stores/deploy-ui.store'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { hasPermission, LIVE_MAP_LAYOUT_WRITE_PERMISSION } from '@/shared/lib/permission'
import { useLineList } from '@/shared/hooks/useLineList'
import { useLineScopeStore } from '@/shared/stores/line-scope.store'
import { LiveMapBoard } from './LiveMapBoard'
import { LiveMapHeader } from './LiveMapHeader'
import { LiveMapStructureLayer } from './LiveMapStructureLayer'

// 사용자가 "데모" 버튼 누른 시점에만 mount. 568 LOC 모달이라 페이지 초기 청크에서 제외.
const LiveMapDemoModal = lazy(() =>
  import('./LiveMapDemoModal').then((module) => ({ default: module.LiveMapDemoModal })),
)

// 3D / 구조물 편집(builder)은 three.js(번들 ~306KB gzip)에 의존한다. 기본 뷰어(2D)는 three 를 쓰지
// 않으므로, 정적 import 로 묶으면 뷰어 첫 진입 청크가 three 로 부풀어 느려진다. 사용자가 3D / builder
// 모드로 전환한 시점에만 lazy 로드해 뷰어 진입 청크에서 three 를 제외한다.
const LiveMap3DScene = lazy(() =>
  import('./LiveMap3DScene').then((module) => ({ default: module.LiveMap3DScene })),
)
const LiveMapObjectEditor = lazy(() =>
  import('./LiveMapObjectEditor').then((module) => ({ default: module.LiveMapObjectEditor })),
)
import {
  applyLiveMapClusterPositionDrafts,
  applyLiveMapEquipmentPositionDrafts,
} from '../lib/live-map-layout'
import { LIVE_MAP_CLUSTER_ITEMS, LIVE_MAP_STATE_OPTIONS } from '../mocks/live-map.mock'
import {
  filterLiveMapEquipmentNodes,
  formatLiveMapSyncLabel,
  resolveSelectedLiveMapEquipment,
  summarizeLiveMapEquipmentNodes,
} from '../lib/live-map-selectors'
import { buildLiveMapEquipmentNodes } from '../lib/live-map-data'
import { useLiveMap } from '../hooks/useLiveMap'
import { useLiveMapUiStore } from '../stores/live-map-ui.store'

type LiveMapViewMode = 'viewer' | 'builder' | 'scene3d'

/**
 * live-map 페이지: 테마형 공정 플로우 뷰어({@link LiveMapBoard}) 가 기본 뷰이고,
 * LIVE_MAP_LAYOUT_WRITE 권한자는 "구조물 편집" 모드로 객체 라이브러리 에디터({@link LiveMapObjectEditor})
 * 에서 3D 객체를 CRUD 하고, "3D" 모드({@link LiveMap3DScene})로 등각 뷰어를 본다.
 *
 * <p>뷰어는 GET /live-map 의 실설비를 공정 카드 그리드에 배치하고(라인 스코프 필터), IN→OUT
 * 흐름·실시간 상태를 보여주며, 설비 선택 시 우측 상세 패널(속성/포트/통신로그)을 연다.</p>
 */
export function LiveMapPage() {
  const { t } = useI18n()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<LiveMapViewMode>('viewer')
  // 상세 패널 닫기(X) — resolver 가 selectedEqpId=null 일 때 ERROR 설비로 자동 폴백하므로,
  // "사용자가 명시적으로 닫음" 을 별도 플래그로 구분해 폴백 복귀를 막는다.
  const [isDetailDismissed, setIsDetailDismissed] = useState(false)

  const meQuery = useMe()
  const canEdit = hasPermission(meQuery.data?.permissionCodes, LIVE_MAP_LAYOUT_WRITE_PERMISSION)

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
  const lineListQuery = useLineList()

  // 선택 라인의 lineKey — 구조물 레이어가 라인별 저장 배치를 조회하는 키.
  const lineKey = useMemo(
    () => lineListQuery.data?.find((line) => line.lineCode === selectedLineValue)?.lineKey ?? null,
    [lineListQuery.data, selectedLineValue],
  )

  const deferredSearchKeyword = useDeferredValue(searchKeyword)

  const clusterItems = useMemo(
    () => applyLiveMapClusterPositionDrafts(LIVE_MAP_CLUSTER_ITEMS, clusterPositionDrafts),
    [clusterPositionDrafts],
  )

  const equipmentNodes = useMemo(
    () =>
      applyLiveMapEquipmentPositionDrafts(
        buildLiveMapEquipmentNodes(liveMapQuery.data?.equipmentItems ?? [], clusterItems),
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
    () => resolveSelectedLiveMapEquipment(equipmentNodes, visibleEquipmentNodes, selectedEqpId),
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

  const syncLabel = useMemo(() => formatLiveMapSyncLabel(lastSyncAt, now), [lastSyncAt, now])

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

  const isBuilderMode = viewMode === 'builder' && canEdit
  const isScene3dMode = viewMode === 'scene3d' && canEdit
  const isViewerMode = !isBuilderMode && !isScene3dMode

  return (
    <AppPageShell
      currentMenu="dash"
      onOpenProfile={() => setIsProfileModalOpen(true)}
      onAfterLogout={handleAfterLogout}
    >
      {/* scrollbarGutter:stable — 뷰어/빌더 콘텐츠 높이 차이로 세로 스크롤바가 모드마다 생겼다 사라지며
          우측 정렬 KPI 그리드가 8px 씩 밀리는 것을 막는다(스크롤바 자리 상시 확보). */}
      <main
        className="thin-scroll min-h-0 flex-1 overflow-y-auto"
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className="flex w-full flex-col gap-4 px-6 py-6">
          <LiveMapHeader summary={summary} />
          {liveMapQuery.isError ? (
            <div className="rounded-[18px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {liveMapQuery.error instanceof Error ? liveMapQuery.error.message : t('livemap.error')}
            </div>
          ) : null}

          {canEdit ? (
            <div className="flex justify-end">
              <div className="inline-flex rounded-pill border border-border bg-card p-1 shadow-soft-sm">
                <button
                  type="button"
                  data-testid="live-map-mode-viewer"
                  aria-pressed={isViewerMode}
                  onClick={() => setViewMode('viewer')}
                  className={`rounded-pill px-4 py-1.5 text-[12px] font-bold transition-colors ${
                    isViewerMode
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('livemap.mode.viewer')}
                </button>
                <button
                  type="button"
                  data-testid="live-map-mode-3d"
                  aria-pressed={isScene3dMode}
                  onClick={() => setViewMode('scene3d')}
                  className={`rounded-pill px-4 py-1.5 text-[12px] font-bold transition-colors ${
                    isScene3dMode
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  3D
                </button>
                <button
                  type="button"
                  data-testid="live-map-mode-builder"
                  aria-pressed={isBuilderMode}
                  onClick={() => setViewMode('builder')}
                  className={`rounded-pill px-4 py-1.5 text-[12px] font-bold transition-colors ${
                    isBuilderMode
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('livemap.mode.builder')}
                </button>
              </div>
            </div>
          ) : null}

          {isBuilderMode ? (
            <Suspense
              fallback={
                <div className="rounded-[18px] border border-border bg-card px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
                  {t('livemap.loading')}
                </div>
              }
            >
              <LiveMapObjectEditor />
            </Suspense>
          ) : isScene3dMode ? (
            <Suspense
              fallback={
                <div className="rounded-[18px] border border-border bg-card px-4 py-8 text-center text-sm font-semibold text-muted-foreground">
                  {t('livemap.loading')}
                </div>
              }
            >
              <LiveMap3DScene lineKey={lineKey} />
            </Suspense>
          ) : (
            <LiveMapBoard
              backgroundLayer={<LiveMapStructureLayer lineKey={lineKey} />}
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
          )}

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
