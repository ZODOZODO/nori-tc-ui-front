import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { Maximize2, Minus, Move, Plus, Radar, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/i18n/i18n-context'
import { LiveMapMachineNode } from './LiveMapMachineNode'
import { LiveMapTooltipCard } from './LiveMapTooltipCard'
import { clampLiveMapRectPosition } from '../lib/live-map-layout'
import { LIVE_MAP_BOARD_HEIGHT, LIVE_MAP_BOARD_WIDTH } from '../mocks/live-map.mock'
import type {
  LiveMapClusterItem,
  LiveMapEquipmentNode,
  LiveMapPoint,
  LiveMapStatusFilter,
} from '../types/live-map.types'

interface LiveMapBoardProps {
  /** board 캔버스 뒤에 깔리는 배경 레이어(구조물 floor-plan 등). 캔버스 스케일을 함께 받는다. */
  backgroundLayer?: ReactNode
  clusters: readonly LiveMapClusterItem[]
  syncLabel: string
  searchKeyword: string
  selectedStatus: LiveMapStatusFilter
  stateOptions: readonly { value: LiveMapStatusFilter; label: string }[]
  onSearchKeywordChange: (searchKeyword: string) => void
  onSelectedStatusChange: (selectedStatus: LiveMapStatusFilter) => void
  equipmentNodes: readonly LiveMapEquipmentNode[]
  visibleEquipmentIds: ReadonlySet<string>
  selectedEquipment: LiveMapEquipmentNode | null
  zoomLevel: number
  isLayoutEditEnabled: boolean
  onSelectEquipment: (eqpId: string) => void
  onClearSelection: () => void
  onLayoutEditEnabledChange: (isLayoutEditEnabled: boolean) => void
  onMoveCluster: (clusterId: string, clusterPosition: LiveMapPoint) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
}

interface TerminalPoint {
  cx: number
  cy: number
}

type DragState =
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
    }
  | {
      kind: 'terminal'
      terminal: 'in' | 'out'
      pointerId: number
      originX: number
      originY: number
      baseCx: number
      baseCy: number
    }

interface PanState {
  pointerId: number
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
}

const TERMINAL_RADIUS = 26

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

interface RailButtonProps {
  icon: typeof Plus
  label: string
  onClick: () => void
  active?: boolean
}

function RailButton({ icon: Icon, label, onClick, active = false }: RailButtonProps) {
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

// 클러스터별 상태 분포 세그먼트 바(모니터링 큐) — RUN/IDLE/ERROR/DOWN 비율을 한 줄로.
const STATUS_SEGMENTS: readonly { key: LiveMapEquipmentNode['status']; cls: string }[] = [
  { key: 'RUN', cls: 'bg-success' },
  { key: 'IDLE', cls: 'bg-sky-500' },
  { key: 'ERROR', cls: 'bg-danger' },
  { key: 'DOWN', cls: 'bg-muted-foreground' },
]

export function LiveMapBoard({
  backgroundLayer,
  clusters,
  syncLabel,
  searchKeyword,
  selectedStatus,
  stateOptions,
  onSearchKeywordChange,
  onSelectedStatusChange,
  equipmentNodes,
  visibleEquipmentIds,
  selectedEquipment,
  zoomLevel,
  isLayoutEditEnabled,
  onSelectEquipment,
  onClearSelection,
  onLayoutEditEnabledChange,
  onMoveCluster,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: LiveMapBoardProps) {
  const { t } = useI18n()
  const boardScrollerRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<PanState | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  // IN/OUT 종단 위치 override — 사용자가 편집모드에서 끌면 설정, null 이면 첫/마지막 카드 기준 자동.
  const [inOverride, setInOverride] = useState<TerminalPoint | null>(null)
  const [outOverride, setOutOverride] = useState<TerminalPoint | null>(null)
  // 보드(고정 px)를 스크롤러 폭에 맞춰 자동 축소 — 전체 공정 흐름을 가로 스크롤 없이 한눈에.
  // 사용자 zoom(store)은 이 위에 곱해지는 배율로 유지된다(effectiveScale).
  const [fitScale, setFitScale] = useState(1)
  const effectiveScale = fitScale * zoomLevel

  // 선택설비 패널 슬라이드 — 열림은 selectedEquipment 존재 여부로 결정.
  // 닫힐 때(우측 슬라이드아웃) 마지막 설비 내용을 유지해야 빈 카드가 비치지 않으므로,
  // 새 설비가 선택될 때만 렌더 단계에서 갱신하고, 닫힘 동안에는 직전 설비를 그대로 보여준다.
  const [renderedEquipment, setRenderedEquipment] = useState(selectedEquipment)
  if (selectedEquipment !== null && selectedEquipment !== renderedEquipment) {
    setRenderedEquipment(selectedEquipment)
  }
  const isPanelOpen = selectedEquipment !== null

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

  // 클러스터 간 커넥터 + IN/OUT 기본 위치(카드 rect 기준). 종단 override 는 별도 적용.
  const flow = useMemo(() => {
    if (clusters.length === 0) {
      return null
    }
    const first = clusters[0]
    const last = clusters[clusters.length - 1]
    const interEdges: string[] = []
    for (let i = 0; i < clusters.length - 1; i += 1) {
      const a = clusters[i]
      const b = clusters[i + 1]
      const aRight = a.x + a.width
      const aCy = a.y + a.height / 2
      const bLeft = b.x
      const bCy = b.y + b.height / 2
      if (Math.abs(a.y - b.y) < 12) {
        const midX = (aRight + bLeft) / 2
        interEdges.push(`M ${aRight} ${aCy} H ${midX} V ${bCy} H ${bLeft}`)
      } else {
        const gapY = (a.y + a.height + b.y) / 2
        const leftX = bLeft - 44
        interEdges.push(`M ${a.x + a.width / 2} ${a.y + a.height} V ${gapY} H ${leftX} V ${bCy} H ${bLeft}`)
      }
    }
    return {
      interEdges,
      firstX: first.x,
      firstCy: first.y + first.height / 2,
      lastRight: last.x + last.width,
      lastCy: last.y + last.height / 2,
      defaultIn: { cx: first.x - 56, cy: first.y + first.height / 2 },
      defaultOut: { cx: last.x + last.width + 56, cy: last.y + last.height / 2 },
    }
  }, [clusters])

  const inTerminal = inOverride ?? flow?.defaultIn ?? null
  const outTerminal = outOverride ?? flow?.defaultOut ?? null

  useEffect(() => {
    const scroller = boardScrollerRef.current
    if (!scroller) {
      return
    }
    const measure = () => {
      const available = scroller.clientWidth - 2
      // 가용 폭에 맞춰 보드를 채운다. 1 로 상한을 두면 와이드 화면에서 보드(1350px)
      // 오른쪽에 드래그로 닿을 수 없는 빈 공간이 남아 카드가 우측 끝까지 못 간다.
      setFitScale(Math.max(0.5, available / LIVE_MAP_BOARD_WIDTH))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  // 카드 / IN-OUT 종단 드래그(편집 모드).
  useEffect(() => {
    if (!dragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return
      }
      if (dragState.kind === 'cluster') {
        const nextPosition = clampLiveMapRectPosition(
          {
            x: dragState.baseX + (event.clientX - dragState.originX) / effectiveScale,
            y: dragState.baseY + (event.clientY - dragState.originY) / effectiveScale,
          },
          dragState.width,
          dragState.height,
          LIVE_MAP_BOARD_WIDTH,
          LIVE_MAP_BOARD_HEIGHT,
        )
        startTransition(() => {
          onMoveCluster(dragState.clusterId, nextPosition)
        })
        return
      }
      const nextPoint: TerminalPoint = {
        cx: clamp(
          dragState.baseCx + (event.clientX - dragState.originX) / effectiveScale,
          TERMINAL_RADIUS,
          LIVE_MAP_BOARD_WIDTH - TERMINAL_RADIUS,
        ),
        cy: clamp(
          dragState.baseCy + (event.clientY - dragState.originY) / effectiveScale,
          TERMINAL_RADIUS,
          LIVE_MAP_BOARD_HEIGHT - TERMINAL_RADIUS,
        ),
      }
      if (dragState.terminal === 'in') {
        setInOverride(nextPoint)
      } else {
        setOutOverride(nextPoint)
      }
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
  }, [dragState, onMoveCluster, effectiveScale])

  // 빈 캔버스 드래그로 팬(스크롤) — 확대 상태에서 마우스로 끌어서 이동(비편집 모드).
  useEffect(() => {
    if (!isPanning) {
      return
    }
    const handlePointerMove = (event: PointerEvent) => {
      const pan = panRef.current
      const scroller = boardScrollerRef.current
      if (!pan || !scroller || event.pointerId !== pan.pointerId) {
        return
      }
      scroller.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX)
      scroller.scrollTop = pan.scrollTop - (event.clientY - pan.startY)
    }
    const handlePointerEnd = (event: PointerEvent) => {
      if (panRef.current && event.pointerId === panRef.current.pointerId) {
        panRef.current = null
        setIsPanning(false)
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
  }, [isPanning])

  const handleClusterHandlePointerDown = (
    cluster: LiveMapClusterItem,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isLayoutEditEnabled) {
      return
    }
    event.preventDefault()
    setDragState({
      kind: 'cluster',
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

  const handleTerminalPointerDown = (
    terminal: 'in' | 'out',
    point: TerminalPoint,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isLayoutEditEnabled) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setDragState({
      kind: 'terminal',
      terminal,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      baseCx: point.cx,
      baseCy: point.cy,
    })
  }

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // 비편집 모드에서 빈 배경을 끌면 팬. 카드/종단/노드 위가 아닐 때만.
    if (isLayoutEditEnabled || event.target !== event.currentTarget) {
      return
    }
    const scroller = boardScrollerRef.current
    if (!scroller) {
      return
    }
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: scroller.scrollLeft,
      scrollTop: scroller.scrollTop,
    }
    setIsPanning(true)
  }

  const edges =
    flow && inTerminal && outTerminal
      ? [
          `M ${inTerminal.cx} ${inTerminal.cy} L ${flow.firstX} ${flow.firstCy}`,
          ...flow.interEdges,
          `M ${flow.lastRight} ${flow.lastCy} L ${outTerminal.cx} ${outTerminal.cy}`,
        ]
      : []

  return (
    <section
      data-testid="live-map-viewer-board"
      className="relative overflow-hidden rounded-[24px] border border-border bg-card p-5 shadow-soft-lg"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[620px]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[17px] font-extrabold text-foreground">
              {t('livemap.board.title')}
            </h2>
            <span className="inline-flex h-6 items-center gap-1.5 rounded-pill border border-success/30 bg-success/10 px-2.5 text-[11px] font-bold text-success">
              <Radar className="size-3" />
              {t('livemap.realtime')} {syncLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t('livemap.board.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchKeyword}
              onChange={(event) => onSearchKeywordChange(event.target.value)}
              placeholder={t('livemap.search.placeholder')}
              className="h-8 w-[220px] rounded-[12px] pl-9 text-sm"
            />
          </div>

          <Select
            value={selectedStatus}
            onValueChange={(value) => onSelectedStatusChange(value as LiveMapStatusFilter)}
          >
            <SelectTrigger className="h-8 w-[140px] rounded-[12px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stateOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-5 flex items-stretch">
        <div className="relative min-w-0 flex-1">
          <div
            ref={boardScrollerRef}
            className="thin-scroll overflow-auto rounded-[18px] border border-border bg-muted/20"
            style={{ maxHeight: 760 }}
          >
            <div
              className="relative"
              style={{
                width: LIVE_MAP_BOARD_WIDTH * effectiveScale,
                height: LIVE_MAP_BOARD_HEIGHT * effectiveScale,
              }}
            >
              <div
                onPointerDown={handleBoardPointerDown}
                className={`live-map-canvas relative ${
                  isLayoutEditEnabled ? '' : isPanning ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                style={{
                  width: LIVE_MAP_BOARD_WIDTH,
                  height: LIVE_MAP_BOARD_HEIGHT,
                  transform: `scale(${effectiveScale})`,
                  transformOrigin: 'top left',
                }}
              >
                {backgroundLayer}
                {edges.length > 0 ? (
                  <svg
                    className="pointer-events-none absolute inset-0 text-brand-primary/45"
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
                    {edges.map((edge, index) => (
                      <g key={index}>
                        <path
                          d={edge}
                          stroke="currentColor"
                          strokeOpacity={0.22}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerEnd="url(#live-map-arrow)"
                        />
                        <path
                          className="live-map-flow-edge"
                          d={edge}
                          stroke="currentColor"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    ))}
                  </svg>
                ) : null}

                {inTerminal ? (
                  <div
                    onPointerDown={(event) => handleTerminalPointerDown('in', inTerminal, event)}
                    className={`absolute flex items-center justify-center rounded-full border border-border bg-card text-[12px] font-extrabold tracking-wide text-muted-foreground shadow-soft-sm ${
                      isLayoutEditEnabled
                        ? 'cursor-grab hover:border-brand-primary/50'
                        : ''
                    }`}
                    style={{
                      left: inTerminal.cx - TERMINAL_RADIUS,
                      top: inTerminal.cy - TERMINAL_RADIUS,
                      width: TERMINAL_RADIUS * 2,
                      height: TERMINAL_RADIUS * 2,
                    }}
                  >
                    IN
                  </div>
                ) : null}
                {outTerminal ? (
                  <div
                    onPointerDown={(event) => handleTerminalPointerDown('out', outTerminal, event)}
                    className={`absolute flex items-center justify-center rounded-full border border-brand-primary/40 bg-brand-primary/10 text-[12px] font-extrabold tracking-wide text-brand-primary shadow-soft-sm ${
                      isLayoutEditEnabled ? 'cursor-grab hover:border-brand-primary' : ''
                    }`}
                    style={{
                      left: outTerminal.cx - TERMINAL_RADIUS,
                      top: outTerminal.cy - TERMINAL_RADIUS,
                      width: TERMINAL_RADIUS * 2,
                      height: TERMINAL_RADIUS * 2,
                    }}
                  >
                    OUT
                  </div>
                ) : null}

                {clusters.map((cluster) => {
                  const clusterNodes = nodesByCluster.get(cluster.id) ?? []
                  const containsSelected = selectedEquipment?.clusterId === cluster.id
                  const isDragging = dragState?.kind === 'cluster' && dragState.clusterId === cluster.id
                  const hasError = clusterNodes.some((node) => node.status === 'ERROR')
                  const total = clusterNodes.length || 1

                  return (
                    <div
                      key={cluster.id}
                      className={`absolute flex flex-col overflow-hidden rounded-[18px] border bg-card/95 shadow-soft-sm backdrop-blur-sm ${
                        containsSelected
                          ? 'border-brand-primary/50 ring-1 ring-brand-primary/30'
                          : hasError
                            ? 'border-danger/50 ring-1 ring-danger/25'
                            : 'border-border'
                      } ${isDragging ? 'z-10 ring-2 ring-brand-primary/40' : ''}`}
                      style={{
                        left: cluster.x,
                        top: cluster.y,
                        width: cluster.width,
                        height: cluster.height,
                      }}
                    >
                      <div
                        className={`flex items-start justify-between gap-2 px-4 pt-3 ${
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
                        <span className="flex shrink-0 items-center gap-1.5">
                          {hasError ? (
                            <span className="size-1.5 animate-pulse rounded-full bg-danger [box-shadow:0_0_8px_var(--danger)]" />
                          ) : null}
                          <span className="rounded-pill bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {clusterNodes.length}
                          </span>
                        </span>
                      </div>

                      <div className="mx-3 mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
                        {STATUS_SEGMENTS.map((segment) => {
                          const count = clusterNodes.filter((node) => node.status === segment.key).length
                          if (count === 0) {
                            return null
                          }
                          return (
                            <span
                              key={segment.key}
                              className={segment.cls}
                              style={{ width: `${(count / total) * 100}%` }}
                            />
                          )
                        })}
                      </div>

                      <div className="thin-scroll mt-2 min-h-0 flex-1 overflow-auto px-3 pb-3">
                        <div className="flex flex-col gap-1">
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

          <div className="absolute left-4 top-4 inline-flex flex-col items-center gap-1.5 rounded-[16px] border border-border bg-card/80 px-1.5 py-2 shadow-soft-md backdrop-blur-sm">
            <RailButton icon={Plus} label={t('livemap.zoom.in')} onClick={onZoomIn} />
            <RailButton icon={Minus} label={t('livemap.zoom.out')} onClick={onZoomOut} />
            <RailButton icon={Maximize2} label={t('livemap.zoom.reset')} onClick={onResetZoom} />
            <span className="my-0.5 h-px w-5 bg-border" />
            <RailButton
              icon={Move}
              label={t('livemap.tool.move')}
              active={isLayoutEditEnabled}
              onClick={() => onLayoutEditEnabledChange(!isLayoutEditEnabled)}
            />
          </div>
        </div>

        <div
          className={`shrink-0 overflow-hidden transition-[width,margin] duration-300 ease-out ${
            isPanelOpen ? 'ml-4 w-[340px] 2xl:w-[360px]' : 'ml-0 w-0'
          }`}
        >
          <div
            className={`h-full w-[340px] 2xl:w-[360px] transition-transform duration-300 ease-out ${
              isPanelOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <LiveMapTooltipCard equipment={renderedEquipment} onClose={onClearSelection} />
          </div>
        </div>
      </div>
    </section>
  )
}
