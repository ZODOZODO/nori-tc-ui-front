import type { PointerEvent as ReactPointerEvent } from 'react'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Beaker, Hand, LocateFixed, Maximize2, Minus, Move, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/i18n-context'
import { LiveMapMachineNode } from './LiveMapMachineNode'
import { LiveMapTooltipCard } from './LiveMapTooltipCard'
import { clampLiveMapRectPosition } from '../lib/live-map-layout'
import { LIVE_MAP_BOARD_HEIGHT, LIVE_MAP_BOARD_WIDTH } from '../mocks/live-map.mock'
import type {
  LiveMapClusterItem,
  LiveMapEquipmentNode,
  LiveMapPoint,
} from '../types/live-map.types'

interface LiveMapBoardProps {
  clusters: readonly LiveMapClusterItem[]
  equipmentNodes: readonly LiveMapEquipmentNode[]
  visibleEquipmentIds: ReadonlySet<string>
  selectedEquipment: LiveMapEquipmentNode | null
  zoomLevel: number
  isLayoutEditEnabled: boolean
  onSelectEquipment: (eqpId: string) => void
  onClearSelection: () => void
  onOpenDemo: () => void
  onLayoutEditEnabledChange: (isLayoutEditEnabled: boolean) => void
  onMoveCluster: (clusterId: string, clusterPosition: LiveMapPoint) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
}

interface ClusterDragState {
  clusterId: string
  pointerId: number
  originX: number
  originY: number
  baseX: number
  baseY: number
  width: number
  height: number
}

const TERMINAL_RADIUS = 26

interface RailButtonProps {
  icon: typeof Hand
  label: string
  active: boolean
  onClick: () => void
}

function RailButton({ icon: Icon, label, active, onClick }: RailButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`rounded-[10px] border transition-colors ${
        active
          ? 'border-brand-primary/40 bg-brand-primary/10 text-brand-primary'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="size-4" />
    </Button>
  )
}

export function LiveMapBoard({
  clusters,
  equipmentNodes,
  visibleEquipmentIds,
  selectedEquipment,
  zoomLevel,
  isLayoutEditEnabled,
  onSelectEquipment,
  onClearSelection,
  onOpenDemo,
  onLayoutEditEnabledChange,
  onMoveCluster,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: LiveMapBoardProps) {
  const { t } = useI18n()
  const boardScrollerRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<ClusterDragState | null>(null)

  const nodesByCluster = useMemo(() => {
    const map = new Map<string, LiveMapEquipmentNode[]>()
    for (const node of equipmentNodes) {
      const bucket = map.get(node.clusterId)
      if (bucket) {
        bucket.push(node)
      } else {
        map.set(node.clusterId, [node])
      }
    }
    return map
  }, [equipmentNodes])

  // 플로우 커넥터(IN → 배열 순서 → OUT) — 카드 rect 에서 직접 계산해 drag/zoom 에 따라 갱신.
  const flow = useMemo(() => {
    if (clusters.length === 0) {
      return null
    }
    const first = clusters[0]
    const last = clusters[clusters.length - 1]
    const inTerminal = { cx: first.x - 56, cy: first.y + first.height / 2 }
    const outTerminal = { cx: last.x + last.width + 56, cy: last.y + last.height / 2 }
    const edges: string[] = [`M ${inTerminal.cx} ${inTerminal.cy} H ${first.x}`]
    for (let i = 0; i < clusters.length - 1; i += 1) {
      const a = clusters[i]
      const b = clusters[i + 1]
      const aRight = a.x + a.width
      const aCy = a.y + a.height / 2
      const bLeft = b.x
      const bCy = b.y + b.height / 2
      if (Math.abs(a.y - b.y) < 12) {
        const midX = (aRight + bLeft) / 2
        edges.push(`M ${aRight} ${aCy} H ${midX} V ${bCy} H ${bLeft}`)
      } else {
        const gapY = (a.y + a.height + b.y) / 2
        const leftX = bLeft - 44
        edges.push(`M ${a.x + a.width / 2} ${a.y + a.height} V ${gapY} H ${leftX} V ${bCy} H ${bLeft}`)
      }
    }
    edges.push(`M ${last.x + last.width} ${outTerminal.cy} H ${outTerminal.cx}`)
    return { inTerminal, outTerminal, edges }
  }, [clusters])

  useEffect(() => {
    if (!dragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return
      }
      const nextPosition = clampLiveMapRectPosition(
        {
          x: dragState.baseX + (event.clientX - dragState.originX) / zoomLevel,
          y: dragState.baseY + (event.clientY - dragState.originY) / zoomLevel,
        },
        dragState.width,
        dragState.height,
        LIVE_MAP_BOARD_WIDTH,
        LIVE_MAP_BOARD_HEIGHT,
      )
      startTransition(() => {
        onMoveCluster(dragState.clusterId, nextPosition)
      })
    }

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId === dragState.pointerId) {
        setDragState(null)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerEnd)
    window.addEventListener('pointercancel', handlePointerEnd)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerEnd)
    }
  }, [dragState, onMoveCluster, zoomLevel])

  const handleLocateSelectedEquipment = () => {
    if (!selectedEquipment || !boardScrollerRef.current) {
      return
    }
    const cluster = clusters.find((item) => item.id === selectedEquipment.clusterId)
    if (!cluster) {
      return
    }
    const scroller = boardScrollerRef.current
    const targetCenterX = (cluster.x + cluster.width / 2) * zoomLevel
    const targetCenterY = (cluster.y + cluster.height / 2) * zoomLevel
    scroller.scrollTo({
      left: Math.max(0, targetCenterX - scroller.clientWidth / 2),
      top: Math.max(0, targetCenterY - scroller.clientHeight / 2),
      behavior: 'smooth',
    })
  }

  const handleClusterHandlePointerDown = (
    cluster: LiveMapClusterItem,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isLayoutEditEnabled) {
      return
    }
    event.preventDefault()
    setDragState({
      clusterId: cluster.id,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      baseX: cluster.x,
      baseY: cluster.y,
      width: cluster.width,
      height: cluster.height,
    })
  }

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-border bg-card p-5 shadow-soft-lg">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[620px]">
          <h2 className="text-[17px] font-extrabold text-foreground">
            {t('livemap.board.title')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('livemap.board.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center gap-2 rounded-pill border border-success/30 bg-success/10 px-3 text-[11px] font-bold text-success">
            <RefreshCw className="size-3.5" />
            {t('livemap.board.autoRefresh')}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onOpenDemo}
            className="h-8 rounded-pill bg-brand-primary px-4 text-[12px] font-bold text-white hover:bg-brand-primary/90"
          >
            <Beaker className="size-3.5" />
            {t('livemap.board.demo')}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative">
          <div
            ref={boardScrollerRef}
            className="overflow-auto rounded-[18px] border border-border bg-muted/40"
            style={{ maxHeight: 760 }}
          >
            <div
              className="relative"
              style={{
                width: LIVE_MAP_BOARD_WIDTH * zoomLevel,
                height: LIVE_MAP_BOARD_HEIGHT * zoomLevel,
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
                {flow ? (
                  <svg
                    className="pointer-events-none absolute inset-0 text-muted-foreground/45"
                    width={LIVE_MAP_BOARD_WIDTH}
                    height={LIVE_MAP_BOARD_HEIGHT}
                    fill="none"
                  >
                    <defs>
                      <marker
                        id="live-map-arrow"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                      </marker>
                    </defs>
                    {flow.edges.map((edge, index) => (
                      <path
                        key={index}
                        d={edge}
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        markerEnd="url(#live-map-arrow)"
                      />
                    ))}
                  </svg>
                ) : null}

                {flow ? (
                  <>
                    <div
                      className="absolute flex items-center justify-center rounded-full border border-border bg-card text-[12px] font-extrabold tracking-wide text-muted-foreground shadow-soft-sm"
                      style={{
                        left: flow.inTerminal.cx - TERMINAL_RADIUS,
                        top: flow.inTerminal.cy - TERMINAL_RADIUS,
                        width: TERMINAL_RADIUS * 2,
                        height: TERMINAL_RADIUS * 2,
                      }}
                    >
                      IN
                    </div>
                    <div
                      className="absolute flex items-center justify-center rounded-full border border-brand-primary/40 bg-brand-primary/10 text-[12px] font-extrabold tracking-wide text-brand-primary shadow-soft-sm"
                      style={{
                        left: flow.outTerminal.cx - TERMINAL_RADIUS,
                        top: flow.outTerminal.cy - TERMINAL_RADIUS,
                        width: TERMINAL_RADIUS * 2,
                        height: TERMINAL_RADIUS * 2,
                      }}
                    >
                      OUT
                    </div>
                  </>
                ) : null}

                {clusters.map((cluster) => {
                  const clusterNodes = nodesByCluster.get(cluster.id) ?? []
                  const containsSelected = selectedEquipment?.clusterId === cluster.id
                  const isDragging = dragState?.clusterId === cluster.id

                  return (
                    <div
                      key={cluster.id}
                      className={`absolute flex flex-col overflow-hidden rounded-[18px] border bg-card shadow-soft-sm ${
                        containsSelected
                          ? 'border-brand-primary/50 ring-1 ring-brand-primary/30'
                          : 'border-border'
                      } ${isDragging ? 'ring-2 ring-brand-primary/40' : ''}`}
                      style={{
                        left: cluster.x,
                        top: cluster.y,
                        width: cluster.width,
                        height: cluster.height,
                      }}
                    >
                      <div
                        className={`flex items-start justify-between gap-2 border-b border-border px-4 pb-2.5 pt-3 ${
                          isLayoutEditEnabled
                            ? isDragging
                              ? 'cursor-grabbing'
                              : 'cursor-grab'
                            : 'cursor-default'
                        }`}
                        onPointerDown={(event) => handleClusterHandlePointerDown(cluster, event)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="h-3.5 w-[3px] rounded-sm bg-brand-primary" />
                            <span className="truncate text-[15px] font-extrabold text-foreground">
                              {cluster.title}
                            </span>
                          </div>
                          <div className="mt-0.5 pl-[11px] text-[10px] font-semibold text-muted-foreground">
                            {cluster.subtitle}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-pill bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {clusterNodes.length}
                        </span>
                      </div>

                      <div className="min-h-0 flex-1 overflow-auto p-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          {clusterNodes.map((node) => (
                            <LiveMapMachineNode
                              key={node.eqpId}
                              eqpId={node.eqpId}
                              status={node.status}
                              portItems={node.portItems}
                              selected={node.eqpId === selectedEquipment?.eqpId}
                              dimmed={!visibleEquipmentIds.has(node.eqpId)}
                              onSelect={onSelectEquipment}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="absolute left-4 top-4 inline-flex flex-col items-center gap-1.5 rounded-[16px] border border-border bg-card px-1.5 py-2 shadow-soft-md">
            <RailButton
              icon={Hand}
              label={t('livemap.tool.pan')}
              active={!isLayoutEditEnabled}
              onClick={() => onLayoutEditEnabledChange(false)}
            />
            <RailButton
              icon={Move}
              label={t('livemap.tool.move')}
              active={isLayoutEditEnabled}
              onClick={() => onLayoutEditEnabledChange(!isLayoutEditEnabled)}
            />
            <span className="my-0.5 h-px w-5 bg-border" />
            <RailButton icon={Plus} label={t('livemap.zoom.in')} active={false} onClick={onZoomIn} />
            <RailButton icon={Minus} label={t('livemap.zoom.out')} active={false} onClick={onZoomOut} />
            <RailButton icon={Maximize2} label={t('livemap.zoom.reset')} active={false} onClick={onResetZoom} />
            <RailButton
              icon={LocateFixed}
              label={t('livemap.zoom.locate')}
              active={false}
              onClick={handleLocateSelectedEquipment}
            />
          </div>
        </div>

        <div className="min-h-0">
          <LiveMapTooltipCard equipment={selectedEquipment} onClose={onClearSelection} />
        </div>
      </div>
    </section>
  )
}
