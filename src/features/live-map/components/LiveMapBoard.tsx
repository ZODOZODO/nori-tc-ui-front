import type { PointerEvent as ReactPointerEvent } from 'react'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Beaker, Clock3, Grip, LocateFixed, Lock, Maximize2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LIVE_MAP_STATUS_THEME } from '../lib/live-map-status-theme'
import { LiveMapLegend } from './LiveMapLegend'
import { LiveMapMachineNode } from './LiveMapMachineNode'
import { LiveMapTooltipCard } from './LiveMapTooltipCard'
import {
  clampLiveMapEquipmentPosition,
  clampLiveMapRectPosition,
} from '../lib/live-map-layout'
import { LIVE_MAP_BOARD_HEIGHT, LIVE_MAP_BOARD_WIDTH } from '../mocks/live-map.mock'
import type {
  LiveMapClusterItem,
  LiveMapClusterSummaryMap,
  LiveMapEquipmentNode,
  LiveMapEquipmentPositionDrafts,
  LiveMapPoint,
} from '../types/live-map.types'

interface LiveMapBoardProps {
  clusters: readonly LiveMapClusterItem[]
  equipmentNodes: readonly LiveMapEquipmentNode[]
  visibleEquipmentIds: ReadonlySet<string>
  selectedEquipment: LiveMapEquipmentNode | null
  clusterSummaries: LiveMapClusterSummaryMap
  zoomLevel: number
  syncLabel: string
  isLayoutEditEnabled: boolean
  onSelectEquipment: (eqpId: string) => void
  onOpenDemo: () => void
  onLayoutEditEnabledChange: (isLayoutEditEnabled: boolean) => void
  onMoveClusterLayout: (
    clusterId: string,
    clusterPosition: LiveMapPoint,
    equipmentPositions: LiveMapEquipmentPositionDrafts,
  ) => void
  onMoveEquipment: (eqpId: string, x: number, y: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
}

type DragState =
  | {
      kind: 'equipment'
      eqpId: string
      pointerId: number
      originX: number
      originY: number
      baseX: number
      baseY: number
    }
  | {
      kind: 'cluster'
      clusterId: string
      pointerId: number
      originX: number
      originY: number
      baseX: number
      baseY: number
      width: number
      height: number
      equipmentBasePositions: LiveMapEquipmentPositionDrafts
    }

export function LiveMapBoard({
  clusters,
  equipmentNodes,
  visibleEquipmentIds,
  selectedEquipment,
  clusterSummaries,
  zoomLevel,
  syncLabel,
  isLayoutEditEnabled,
  onSelectEquipment,
  onOpenDemo,
  onLayoutEditEnabledChange,
  onMoveClusterLayout,
  onMoveEquipment,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: LiveMapBoardProps) {
  const boardScrollerRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)

  const scaledBoardSize = useMemo(
    () => ({
      width: LIVE_MAP_BOARD_WIDTH * zoomLevel,
      height: LIVE_MAP_BOARD_HEIGHT * zoomLevel,
    }),
    [zoomLevel],
  )

  useEffect(() => {
    if (!dragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return
      }

      if (dragState.kind === 'equipment') {
        const nextPosition = clampLiveMapEquipmentPosition(
          {
            x: dragState.baseX + (event.clientX - dragState.originX) / zoomLevel,
            y: dragState.baseY + (event.clientY - dragState.originY) / zoomLevel,
          },
          LIVE_MAP_BOARD_WIDTH,
          LIVE_MAP_BOARD_HEIGHT,
        )

        startTransition(() => {
          onMoveEquipment(dragState.eqpId, nextPosition.x, nextPosition.y)
        })

        return
      }

      const nextClusterPosition = clampLiveMapRectPosition(
        {
          x: dragState.baseX + (event.clientX - dragState.originX) / zoomLevel,
          y: dragState.baseY + (event.clientY - dragState.originY) / zoomLevel,
        },
        dragState.width,
        dragState.height,
        LIVE_MAP_BOARD_WIDTH,
        LIVE_MAP_BOARD_HEIGHT,
      )
      const deltaX = nextClusterPosition.x - dragState.baseX
      const deltaY = nextClusterPosition.y - dragState.baseY
      const nextEquipmentPositions = Object.fromEntries(
        Object.entries(dragState.equipmentBasePositions).map(([eqpId, position]) => [
          eqpId,
          clampLiveMapEquipmentPosition(
            {
              x: position.x + deltaX,
              y: position.y + deltaY,
            },
            LIVE_MAP_BOARD_WIDTH,
            LIVE_MAP_BOARD_HEIGHT,
          ),
        ]),
      )

      startTransition(() => {
        onMoveClusterLayout(
          dragState.clusterId,
          nextClusterPosition,
          nextEquipmentPositions,
        )
      })
    }

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return
      }

      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [dragState, onMoveClusterLayout, onMoveEquipment, zoomLevel])

  const handleLocateSelectedEquipment = () => {
    if (!selectedEquipment || !boardScrollerRef.current) {
      return
    }

    const scroller = boardScrollerRef.current
    const targetCenterX = (selectedEquipment.x + 14) * zoomLevel
    const targetCenterY = (selectedEquipment.y + 20) * zoomLevel

    scroller.scrollTo({
      left: Math.max(0, targetCenterX - scroller.clientWidth / 2),
      top: Math.max(0, targetCenterY - scroller.clientHeight / 2),
      behavior: 'smooth',
    })
  }

  const handleEquipmentPointerDown = (
    eqpId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!isLayoutEditEnabled) {
      return
    }

    const equipment = equipmentNodes.find((item) => item.eqpId === eqpId)
    if (!equipment) {
      return
    }

    event.preventDefault()
    onSelectEquipment(eqpId)
    setDragState({
      kind: 'equipment',
      eqpId,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      baseX: equipment.x,
      baseY: equipment.y,
    })
  }

  const handleClusterPointerDown = (
    clusterId: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isLayoutEditEnabled) {
      return
    }

    const cluster = clusters.find((item) => item.id === clusterId)
    if (!cluster) {
      return
    }

    const equipmentBasePositions = Object.fromEntries(
      equipmentNodes
        .filter((equipment) => equipment.clusterId === clusterId)
        .map((equipment) => [equipment.eqpId, { x: equipment.x, y: equipment.y }]),
    )

    event.preventDefault()
    setDragState({
      kind: 'cluster',
      clusterId,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      baseX: cluster.x,
      baseY: cluster.y,
      width: cluster.width,
      height: cluster.height,
      equipmentBasePositions,
    })
  }

  const handleLayoutEditToggle = () => {
    if (isLayoutEditEnabled) {
      setDragState(null)
    }

    onLayoutEditEnabledChange(!isLayoutEditEnabled)
  }

  const clusterStatusItems = [
    { summaryKey: 'run', status: 'RUN' },
    { summaryKey: 'idle', status: 'IDLE' },
    { summaryKey: 'error', status: 'ERROR' },
    { summaryKey: 'down', status: 'DOWN' },
  ] as const

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-[#232A31] bg-[#171B20] p-6 shadow-[0_18px_40px_rgba(5,6,7,0.35)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[620px]">
          <h2 className="text-[17px] font-extrabold text-[#F2F6FA]">A Line 공정 배치 맵</h2>
          <p className="mt-1 text-xs text-[#8A949E]">
            CVD부터 ETC까지 10개 공정을 공정 단위 카드로 정리한 라이브 보드입니다.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenDemo}
              className="h-7 rounded-[14px] border-[#3D4B43] bg-[#20272D] px-3 text-[11px] font-bold text-[#E3ECE7] hover:bg-[#283139]"
            >
              <Beaker className="size-3.5 text-[#8FDEAA]" />
              Demo
            </Button>

            <button
              type="button"
              role="switch"
              aria-checked={isLayoutEditEnabled}
              onClick={handleLayoutEditToggle}
              className={`inline-flex h-7 items-center gap-2 rounded-[14px] border px-2.5 text-[11px] font-bold transition-colors ${
                isLayoutEditEnabled
                  ? 'border-[#2F6C55] bg-[#122019] text-[#E2F4E8]'
                  : 'border-[#353F47] bg-[#232A31] text-[#D8E1E8]'
              }`}
              aria-label="배치 편집 모드 전환"
            >
              {isLayoutEditEnabled ? (
                <Grip className="size-3 text-[#8FDEAA]" />
              ) : (
                <Lock className="size-3 text-[#95A0AA]" />
              )}
              배치 편집
              <span
                className={`relative h-4 w-8 overflow-hidden rounded-full transition-colors ${
                  isLayoutEditEnabled ? 'bg-[#2F6C55]' : 'bg-[#3B4650]'
                }`}
              >
                <span
                  className={`absolute left-[2px] top-1/2 size-3 -translate-y-1/2 rounded-full bg-white transition-transform ${
                    isLayoutEditEnabled ? 'translate-x-0' : 'translate-x-[14px]'
                  }`}
                />
              </span>
            </button>

            <div className="inline-flex h-7 items-center gap-2 rounded-[14px] border border-[#353F47] bg-[#232A31] px-3 text-[11px] font-bold text-[#D8E1E8]">
              <Clock3 className="size-3 text-[#6C776F]" />
              {syncLabel}
            </div>
          </div>

          <LiveMapLegend />
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative">
          <div
            ref={boardScrollerRef}
            className="overflow-auto rounded-[18px] border border-[#2A3138] bg-[#1B2025]"
          >
            <div
              className="relative"
              style={{
                width: scaledBoardSize.width,
                height: scaledBoardSize.height,
              }}
            >
              <div
                className="relative"
                style={{
                  width: LIVE_MAP_BOARD_WIDTH,
                  height: LIVE_MAP_BOARD_HEIGHT,
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top left',
                }}
              >
                {[64, 244, 424, 604].map((yPosition) => (
                  <div
                    key={yPosition}
                    className="absolute left-[30px] h-px w-[1278px] bg-[#20262D]"
                    style={{ top: yPosition }}
                  />
                ))}

                {clusters.map((cluster) => {
                  const clusterSummary = clusterSummaries[cluster.id] ?? {
                    total: 0,
                    run: 0,
                    idle: 0,
                    error: 0,
                    down: 0,
                  }

                  return (
                    <div
                      key={cluster.id}
                      className={`absolute rounded-[22px] border shadow-[0_4px_8px_rgba(2,4,6,0.15)] ${
                        isLayoutEditEnabled
                          ? dragState?.kind === 'cluster' && dragState.clusterId === cluster.id
                            ? 'cursor-grabbing ring-2 ring-[#8FDEAA]/60'
                            : 'cursor-grab'
                          : 'cursor-default'
                      }`}
                      style={{
                        left: cluster.x,
                        top: cluster.y,
                        width: cluster.width,
                        height: cluster.height,
                        backgroundColor: cluster.panelColor,
                        borderColor: cluster.borderColor,
                      }}
                      onPointerDown={(event) => handleClusterPointerDown(cluster.id, event)}
                    >
                    <div
                      className="absolute left-[18px] top-[18px] h-1 rounded-sm"
                      style={{ width: 54, backgroundColor: cluster.accentColor }}
                    />
                    <div className="absolute left-[18px] top-[30px] text-[15px] font-extrabold tracking-[0.06em] text-[#DCE6ED]">
                      {cluster.title}
                    </div>
                    <div className="absolute left-[18px] top-[54px] text-[10px] font-semibold text-[#7F8B96]">
                      {cluster.subtitle}
                    </div>
                    <div className="absolute inset-x-4 top-[78px] bottom-[92px] rounded-[14px] border border-[#252D35] bg-[#11161A]" />
                    <div className="absolute inset-x-4 bottom-4 grid grid-cols-2 gap-2 rounded-[12px] border border-[#252D35] bg-[#0F1418] px-2.5 py-3">
                      {clusterStatusItems.map((statusItem) => {
                        const theme = LIVE_MAP_STATUS_THEME[statusItem.status]
                        const value = clusterSummary[statusItem.summaryKey]

                        return (
                          <div
                            key={`${cluster.id}-${statusItem.status}`}
                            className="rounded-[9px] border px-2.5 py-2.5"
                            style={{
                              backgroundColor: theme.legendBackground,
                              borderColor: theme.legendBorder,
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="inline-flex items-center gap-1 text-[8px] font-bold tracking-[0.08em]"
                                style={{ color: theme.legendText }}
                              >
                                <span
                                  className="size-1.5 rounded-full"
                                  style={{ backgroundColor: theme.legendDot }}
                                />
                                {statusItem.status}
                              </span>
                              <span
                                className="min-w-[18px] text-right text-[11px] font-extrabold"
                                style={{ color: theme.badgeText }}
                              >
                                {value}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    </div>
                  )
                })}

                {equipmentNodes.map((equipment) => (
                  <LiveMapMachineNode
                    key={equipment.eqpId}
                    eqpId={equipment.eqpId}
                    status={equipment.status}
                    x={equipment.x}
                    y={equipment.y}
                    selected={equipment.eqpId === selectedEquipment?.eqpId}
                    dimmed={!visibleEquipmentIds.has(equipment.eqpId)}
                    editable={isLayoutEditEnabled}
                    dragging={
                      dragState?.kind === 'equipment' && dragState.eqpId === equipment.eqpId
                    }
                    onSelect={onSelectEquipment}
                    onDragStart={handleEquipmentPointerDown}
                  />
                ))}

              </div>
            </div>
          </div>

          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-[16px] border border-[#2B343D] bg-[#11161A] px-2 py-1.5 shadow-[0_10px_20px_rgba(2,4,6,0.4)]">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-[10px] border border-[#303943] bg-[#1A2026] text-[#A7B2BC] hover:bg-[#222A31] hover:text-[#E7EDF2]"
              onClick={onResetZoom}
              aria-label="보드 기본 배율로 맞추기"
            >
              <Maximize2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-[10px] border border-[#303943] bg-[#1A2026] text-[#A7B2BC] hover:bg-[#222A31] hover:text-[#E7EDF2]"
              onClick={handleLocateSelectedEquipment}
              aria-label="선택 설비 위치로 이동"
            >
              <LocateFixed className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-[10px] border border-[#303943] bg-[#1A2026] text-[#A7B2BC] hover:bg-[#222A31] hover:text-[#E7EDF2]"
              onClick={onZoomIn}
              aria-label="맵 확대"
            >
              <Plus className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-[10px] border border-[#303943] bg-[#1A2026] text-[#A7B2BC] hover:bg-[#222A31] hover:text-[#E7EDF2]"
              onClick={onZoomOut}
              aria-label="맵 축소"
            >
              <Minus className="size-4" />
            </Button>
          </div>
        </div>

        <div className="self-start">
          <LiveMapTooltipCard equipment={selectedEquipment} />
        </div>
      </div>
    </section>
  )
}
