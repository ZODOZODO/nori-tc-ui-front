import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  FolderPlus,
  Loader2,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  Radar,
  Save,
  Search,
  SquarePen,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { LiveMapFlowGroupDialog, type LiveMapFlowGroupPatch } from './LiveMapFlowGroupDialog'
import { LiveMapFlowArrowDialog } from './LiveMapFlowArrowDialog'
import {
  computeLiveMapFlowArrowLine,
  type LiveMapFlowArrow,
  type LiveMapFlowArrowPatch,
  type LiveMapFlowGroup,
} from '../lib/live-map-flow.model'
import { LIVE_MAP_BOARD_HEIGHT, LIVE_MAP_BOARD_WIDTH } from '../mocks/live-map.mock'
import type {
  LiveMapEquipmentNode,
  LiveMapPoint,
  LiveMapStatusFilter,
} from '../types/live-map.types'

/** 공정 흐름 그룹 카드 1장 — 그룹(저장 모델) + 소속 설비 노드(미배정 = 여집합). */
export interface LiveMapFlowGroupCard {
  group: LiveMapFlowGroup
  isUnassigned: boolean
  nodes: readonly LiveMapEquipmentNode[]
}

interface LiveMapBoardProps {
  /** board 캔버스 뒤에 깔리는 배경 레이어(구조물 floor-plan 등). 캔버스 스케일을 함께 받는다. */
  backgroundLayer?: ReactNode
  groupCards: readonly LiveMapFlowGroupCard[]
  syncLabel: string
  searchKeyword: string
  selectedStatus: LiveMapStatusFilter
  stateOptions: readonly { value: LiveMapStatusFilter; label: string }[]
  onSearchKeywordChange: (searchKeyword: string) => void
  onSelectedStatusChange: (selectedStatus: LiveMapStatusFilter) => void
  visibleEquipmentIds: ReadonlySet<string>
  selectedEquipment: LiveMapEquipmentNode | null
  zoomLevel: number
  /** LIVE_MAP_LAYOUT_WRITE 보유 여부 — false 면 편집 진입 자체가 불가(이동 토글/CRUD/저장 미노출). */
  canEdit: boolean
  isLayoutEditEnabled: boolean
  onSelectEquipment: (eqpId: string) => void
  onClearSelection: () => void
  onLayoutEditEnabledChange: (isLayoutEditEnabled: boolean) => void
  onMoveGroup: (groupId: string, position: LiveMapPoint) => void
  /** 그룹 카드 크기 조절(우하단 핸들 드래그) — 미배정 그룹 포함. */
  onResizeGroup: (groupId: string, size: { width: number; height: number }) => void
  /** 설비 노드 드래그&드롭 배정(Ctrl+클릭 다중 선택 일괄 포함) — 미배정 그룹으로 드롭 = 배정 해제. */
  onAssignEquipment: (eqpKeys: readonly number[], groupId: string) => void
  onCreateGroup: () => void
  onUpdateGroup: (groupId: string, patch: LiveMapFlowGroupPatch) => void
  onDeleteGroup: (groupId: string) => void
  /** 그룹 간 흐름 화살표 — 개별 객체(끝점 + 스타일). */
  arrows: readonly LiveMapFlowArrow[]
  onCreateArrow: (patch: LiveMapFlowArrowPatch) => void
  onUpdateArrow: (arrowId: string, patch: LiveMapFlowArrowPatch) => void
  onDeleteArrow: (arrowId: string) => void
  isDirty: boolean
  isSaving: boolean
  saveError: string | null
  onSave: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
}

interface DragState {
  groupId: string
  pointerId: number
  originX: number
  originY: number
  baseX: number
  baseY: number
}

interface ResizeState {
  groupId: string
  pointerId: number
  originX: number
  originY: number
  baseWidth: number
  baseHeight: number
}

interface PanState {
  pointerId: number
  startX: number
  startY: number
  scrollLeft: number
  scrollTop: number
}

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

// 그룹별 상태 분포 세그먼트 바(모니터링 큐) — RUN/IDLE/ERROR/DOWN 비율을 한 줄로.
const STATUS_SEGMENTS: readonly { key: LiveMapEquipmentNode['status']; cls: string }[] = [
  { key: 'RUN', cls: 'bg-success' },
  { key: 'IDLE', cls: 'bg-sky-500' },
  { key: 'ERROR', cls: 'bg-danger' },
  { key: 'DOWN', cls: 'bg-muted-foreground' },
]

export function LiveMapBoard({
  backgroundLayer,
  groupCards,
  syncLabel,
  searchKeyword,
  selectedStatus,
  stateOptions,
  onSearchKeywordChange,
  onSelectedStatusChange,
  visibleEquipmentIds,
  selectedEquipment,
  zoomLevel,
  canEdit,
  isLayoutEditEnabled,
  onSelectEquipment,
  onClearSelection,
  onLayoutEditEnabledChange,
  onMoveGroup,
  onResizeGroup,
  onAssignEquipment,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  arrows,
  onCreateArrow,
  onUpdateArrow,
  onDeleteArrow,
  isDirty,
  isSaving,
  saveError,
  onSave,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: LiveMapBoardProps) {
  const { t } = useI18n()
  const boardScrollerRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<PanState | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [editingGroup, setEditingGroup] = useState<LiveMapFlowGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<LiveMapFlowGroup | null>(null)
  // 화살표 다이얼로그 — { arrow: null } = 생성 모드, { arrow } = 편집(삭제 포함) 모드.
  const [arrowDialog, setArrowDialog] = useState<{ arrow: LiveMapFlowArrow | null } | null>(null)
  // 설비 노드 HTML5 드래그&드롭 배정 — dragover 에선 dataTransfer 를 못 읽으므로 ref 로 키를 든다.
  // 다중 선택 노드를 끌면 선택 전체가 함께 이동하므로 배열로 든다.
  const draggingEqpKeysRef = useRef<readonly number[] | null>(null)
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null)
  // Ctrl(⌘)+클릭 다중 선택(편집 모드) — 드래그 1번으로 일괄 배정하기 위한 설비 키 집합.
  const [multiSelectedKeys, setMultiSelectedKeys] = useState<ReadonlySet<number>>(() => new Set())
  // 선택된 노드에 Ctrl+pointerdown — 해제 후보(드래그로 승격되면 해제하지 않고 일괄 이동).
  const pendingDeselectKeyRef = useRef<number | null>(null)
  // 보드(고정 px)를 스크롤러 폭에 맞춰 자동 축소 — 전체 공정 흐름을 가로 스크롤 없이 한눈에.
  // 사용자 zoom(store)은 이 위에 곱해지는 배율로 유지된다(effectiveScale).
  const [fitScale, setFitScale] = useState(1)
  const effectiveScale = fitScale * zoomLevel
  const isEditing = canEdit && isLayoutEditEnabled

  // 편집 모드 종료 시 다중 선택 해제 — 비편집 화면에 선택 링이 남지 않게(render 단계 보정).
  const [wasEditing, setWasEditing] = useState(isEditing)
  if (wasEditing !== isEditing) {
    setWasEditing(isEditing)
    if (!isEditing && multiSelectedKeys.size > 0) {
      setMultiSelectedKeys(new Set())
    }
  }

  // 선택설비 패널 슬라이드 — 열림은 selectedEquipment 존재 여부로 결정.
  // 닫힐 때(우측 슬라이드아웃) 마지막 설비 내용을 유지해야 빈 카드가 비치지 않으므로,
  // 새 설비가 선택될 때만 렌더 단계에서 갱신하고, 닫힘 동안에는 직전 설비를 그대로 보여준다.
  const [renderedEquipment, setRenderedEquipment] = useState(selectedEquipment)
  if (selectedEquipment !== null && selectedEquipment !== renderedEquipment) {
    setRenderedEquipment(selectedEquipment)
  }
  const isPanelOpen = selectedEquipment !== null

  const groupIndex = useMemo(
    () => new Map(groupCards.map((card) => [card.group.id, card])),
    [groupCards],
  )

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

  // 그룹 카드 드래그(편집 모드) — raw 좌표를 올리면 상위(flow 모델)가 20px(점 격자) 스냅 + 보드 clamp.
  useEffect(() => {
    if (!dragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) {
        return
      }
      const nextPosition: LiveMapPoint = {
        x: dragState.baseX + (event.clientX - dragState.originX) / effectiveScale,
        y: dragState.baseY + (event.clientY - dragState.originY) / effectiveScale,
      }
      startTransition(() => {
        onMoveGroup(dragState.groupId, nextPosition)
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
  }, [dragState, onMoveGroup, effectiveScale])

  // 그룹 카드 리사이즈(편집 모드, 우하단 핸들) — raw 크기를 올리면 상위(flow 모델)가 스냅 + clamp.
  useEffect(() => {
    if (!resizeState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== resizeState.pointerId) {
        return
      }
      const nextSize = {
        width: resizeState.baseWidth + (event.clientX - resizeState.originX) / effectiveScale,
        height: resizeState.baseHeight + (event.clientY - resizeState.originY) / effectiveScale,
      }
      startTransition(() => {
        onResizeGroup(resizeState.groupId, nextSize)
      })
    }

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId === resizeState.pointerId) {
        setResizeState(null)
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
  }, [resizeState, onResizeGroup, effectiveScale])

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

  const handleGroupHandlePointerDown = (
    group: LiveMapFlowGroup,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isEditing) {
      return
    }
    event.preventDefault()
    setDragState({
      groupId: group.id,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      baseX: group.x,
      baseY: group.y,
    })
  }

  const handleGroupResizePointerDown = (
    group: LiveMapFlowGroup,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (!isEditing) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    setResizeState({
      groupId: group.id,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      baseWidth: group.width,
      baseHeight: group.height,
    })
  }

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // 비편집 모드에서 빈 배경을 끌면 팬. 카드/노드 위가 아닐 때만.
    if (isEditing || event.target !== event.currentTarget) {
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

  // Ctrl(⌘)+pointerdown 즉시 선택(편집 모드) — 노드가 draggable 이라 클릭 중 마우스가 조금만
  // 움직여도 click 이 드래그로 승격돼 발생하지 않는다. 선택 '등록'은 pointerdown 으로 앞당기고,
  // 이미 선택된 노드는 일괄 드래그의 시작일 수 있으므로 '해제'만 click(드래그 미발생 확정 시점)
  // 으로 유예한다 — 파일 탐색기와 동일한 규칙.
  const handleNodePointerDown = (eqpKey: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isEditing || event.button !== 0 || !(event.ctrlKey || event.metaKey)) {
      return
    }
    if (multiSelectedKeys.has(eqpKey)) {
      pendingDeselectKeyRef.current = eqpKey
      return
    }
    setMultiSelectedKeys((current) => new Set(current).add(eqpKey))
  }

  // Ctrl(⌘)+클릭(편집 모드) — 상세 선택 차단 + pointerdown 에서 유예한 해제를 확정(capture).
  const handleNodeClickCapture = (eqpKey: number, event: ReactMouseEvent<HTMLDivElement>) => {
    const pendingDeselectKey = pendingDeselectKeyRef.current
    pendingDeselectKeyRef.current = null
    if (!isEditing || !(event.ctrlKey || event.metaKey)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (pendingDeselectKey === eqpKey) {
      setMultiSelectedKeys((current) => {
        const next = new Set(current)
        next.delete(eqpKey)
        return next
      })
    }
  }

  const handleNodeDragStart = (eqpKey: number, event: ReactDragEvent<HTMLDivElement>) => {
    // 드래그로 승격 — pointerdown 의 해제 후보는 취소(선택 유지 + 일괄 이동).
    pendingDeselectKeyRef.current = null
    // 다중 선택에 포함된 노드를 끌면 선택 전체. Ctrl(⌘)을 누른 채 곧바로 끌기 시작한 노드는
    // click 이 발생하지 않아 선택 집합에 없을 수 있으므로, 기존 선택과 합쳐 함께 이동시킨다.
    const joinsSelection =
      multiSelectedKeys.has(eqpKey) ||
      ((event.ctrlKey || event.metaKey) && multiSelectedKeys.size > 0)
    const eqpKeys = joinsSelection ? [...new Set([...multiSelectedKeys, eqpKey])] : [eqpKey]
    draggingEqpKeysRef.current = eqpKeys
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', eqpKeys.join(','))
  }

  const handleNodeDragEnd = () => {
    draggingEqpKeysRef.current = null
    pendingDeselectKeyRef.current = null
    setDropTargetGroupId(null)
  }

  const handleNodeDragOver = (card: LiveMapFlowGroupCard, event: ReactDragEvent<HTMLDivElement>) => {
    if (!isEditing || draggingEqpKeysRef.current === null) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTargetGroupId(card.group.id)
  }

  const handleNodeDrop = (card: LiveMapFlowGroupCard, event: ReactDragEvent<HTMLDivElement>) => {
    const eqpKeys = draggingEqpKeysRef.current
    draggingEqpKeysRef.current = null
    setDropTargetGroupId(null)
    if (!isEditing || eqpKeys === null) {
      return
    }
    event.preventDefault()
    // 이미 카드 소속인 노드는 제외 — 같은 카드로의 드롭으로 불필요한 dirty 를 만들지 않는다.
    const movingKeys = eqpKeys.filter((key) => !card.nodes.some((node) => node.eqpKey === key))
    if (movingKeys.length > 0) {
      onAssignEquipment(movingKeys, card.group.id)
      // 일괄 이동 완료 — 다중 선택은 소비된 것으로 보고 비운다.
      setMultiSelectedKeys((current) => (current.size === 0 ? current : new Set()))
    }
  }

  const groupTitle = (card: LiveMapFlowGroupCard): string =>
    card.isUnassigned ? t('livemap.flow.unassigned') : card.group.title

  // 화살표 끝점 후보 — 미배정 라벨까지 해석된 표시명으로 다이얼로그에 전달(그룹명 순 정렬).
  const groupOptions = groupCards
    .map((card) => ({ id: card.group.id, title: groupTitle(card) }))
    .sort((a, b) => a.title.localeCompare(b.title))

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
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCreateGroup}
                data-testid="live-map-flow-add-group"
                className="h-8 rounded-[12px] text-[12px] font-bold"
              >
                <FolderPlus className="size-3.5" />
                {t('livemap.flow.addGroup')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setArrowDialog({ arrow: null })}
                disabled={groupCards.length < 2}
                data-testid="live-map-flow-add-arrow"
                className="h-8 rounded-[12px] text-[12px] font-bold"
              >
                <ArrowRight className="size-3.5" />
                {t('livemap.flow.addArrow')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSave}
                disabled={!isDirty || isSaving}
                data-testid="live-map-flow-save"
                className="h-8 rounded-[12px] text-[12px] font-bold"
              >
                {isSaving ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-3.5" />
                )}
                {t('livemap.flow.save')}
                {isDirty ? <span className="size-1.5 rounded-full bg-amber-400" /> : null}
              </Button>
              {saveError ? (
                <span className="text-[11px] font-semibold text-danger">{saveError}</span>
              ) : null}
            </>
          ) : null}
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
                  isEditing ? '' : isPanning ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                style={{
                  width: LIVE_MAP_BOARD_WIDTH,
                  height: LIVE_MAP_BOARD_HEIGHT,
                  transform: `scale(${effectiveScale})`,
                  transformOrigin: 'top left',
                }}
              >
                {backgroundLayer}

                {/* 그룹 간 흐름 화살표 — 카드 아래 SVG 레이어. 편집 모드에선 넓은 투명 히트 라인으로
                    클릭 → 편집/삭제 다이얼로그. 좌표는 카드 rect 테두리 간 선분(모델 헬퍼). */}
                <svg
                  className="pointer-events-none absolute inset-0"
                  width={LIVE_MAP_BOARD_WIDTH}
                  height={LIVE_MAP_BOARD_HEIGHT}
                >
                  <defs>
                    {arrows.map((arrow) => (
                      <marker
                        key={arrow.id}
                        id={`live-map-flow-arrow-head-${arrow.id}`}
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="4"
                        markerHeight="4"
                        orient="auto"
                      >
                        <path d="M0,0 L10,5 L0,10 z" fill={arrow.color ?? 'var(--brand-primary)'} />
                      </marker>
                    ))}
                  </defs>
                  {arrows.map((arrow) => {
                    const fromGroup = groupIndex.get(arrow.fromGroupId)?.group
                    const toGroup = groupIndex.get(arrow.toGroupId)?.group
                    if (!fromGroup || !toGroup) {
                      return null
                    }
                    const line = computeLiveMapFlowArrowLine(fromGroup, toGroup)
                    if (!line) {
                      return null
                    }
                    const stroke = arrow.color ?? 'var(--brand-primary)'
                    // 파선 = 선분+간격, 점선 = 점(0.1 + round cap)+간격. 패턴 합(주기)은
                    // 흐름 애니메이션의 1 사이클 이동량이기도 하다(이음새 없는 반복 조건).
                    const dashPattern =
                      arrow.dash === 'dashed'
                        ? [arrow.strokeWidth * 4, arrow.strokeWidth * 2.5]
                        : arrow.dash === 'dotted'
                          ? [0.1, arrow.strokeWidth * 2.5]
                          : null
                    return (
                      <g key={arrow.id}>
                        <line
                          x1={line.x1}
                          y1={line.y1}
                          x2={line.x2}
                          y2={line.y2}
                          stroke={stroke}
                          strokeWidth={arrow.strokeWidth}
                          strokeDasharray={dashPattern?.join(' ')}
                          strokeLinecap={arrow.dash === 'dotted' ? 'round' : undefined}
                          markerEnd={`url(#live-map-flow-arrow-head-${arrow.id})`}
                          opacity={0.9}
                          className={dashPattern ? 'live-map-flow-arrow-dash' : undefined}
                          style={
                            dashPattern
                              ? ({
                                  '--live-map-flow-dash-period': `${dashPattern[0] + dashPattern[1]}px`,
                                } as CSSProperties)
                              : undefined
                          }
                        />
                        {isEditing ? (
                          <line
                            x1={line.x1}
                            y1={line.y1}
                            x2={line.x2}
                            y2={line.y2}
                            stroke="transparent"
                            strokeWidth={Math.max(14, arrow.strokeWidth + 10)}
                            className="pointer-events-auto cursor-pointer"
                            data-testid={`live-map-flow-arrow-${arrow.id}`}
                            onClick={() => setArrowDialog({ arrow })}
                          />
                        ) : null}
                      </g>
                    )
                  })}
                </svg>

                {groupCards.map((card) => {
                  const { group } = card
                  const containsSelected = selectedEquipment
                    ? card.nodes.some((node) => node.eqpId === selectedEquipment.eqpId)
                    : false
                  const isDragging = dragState?.groupId === group.id
                  const isDropTarget = dropTargetGroupId === group.id
                  const hasError = card.nodes.some((node) => node.status === 'ERROR')
                  const total = card.nodes.length || 1

                  return (
                    <div
                      key={group.id}
                      data-testid={`live-map-flow-group-${group.id}`}
                      onDragOver={(event) => handleNodeDragOver(card, event)}
                      onDrop={(event) => handleNodeDrop(card, event)}
                      className={`absolute flex flex-col overflow-hidden rounded-[18px] border bg-card/95 shadow-soft-sm backdrop-blur-sm ${
                        isDropTarget
                          ? 'border-brand-primary/60 ring-2 ring-brand-primary/40'
                          : containsSelected
                            ? 'border-brand-primary/50 ring-1 ring-brand-primary/30'
                            : hasError
                              ? 'border-danger/50 ring-1 ring-danger/25'
                              : 'border-border'
                      } ${isDragging ? 'z-10 ring-2 ring-brand-primary/40' : ''}`}
                      style={{
                        left: group.x,
                        top: group.y,
                        width: group.width,
                        height: group.height,
                        // 사용자 색 테두리 — 선택/에러 상태 시각(우선)과 겹치지 않을 때만.
                        ...(group.color && !containsSelected && !hasError
                          ? { borderColor: `${group.color}66` }
                          : {}),
                      }}
                    >
                      <div
                        className={`flex items-start justify-between gap-2 px-4 pt-3 ${
                          isEditing ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                        }`}
                        onPointerDown={(event) => handleGroupHandlePointerDown(group, event)}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3.5 w-[3px] rounded-sm bg-brand-primary"
                              style={group.color ? { backgroundColor: group.color } : undefined}
                            />
                            <span className="truncate text-[15px] font-extrabold text-foreground">
                              {groupTitle(card)}
                            </span>
                          </div>
                          {group.subtitle ? (
                            <div className="mt-0.5 pl-[11px] text-[10px] font-semibold text-muted-foreground">
                              {group.subtitle}
                            </div>
                          ) : null}
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {hasError ? (
                            <span className="size-1.5 animate-pulse rounded-full bg-danger [box-shadow:0_0_8px_var(--danger)]" />
                          ) : null}
                          {isEditing && !card.isUnassigned ? (
                            <span
                              className="flex items-center gap-1"
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => setEditingGroup(group)}
                                aria-label={t('livemap.flow.editGroup')}
                                data-testid={`live-map-flow-group-edit-${group.id}`}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <Pencil className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingGroup(group)}
                                aria-label={t('livemap.flow.deleteGroup')}
                                data-testid={`live-map-flow-group-delete-${group.id}`}
                                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </span>
                          ) : null}
                          <span className="rounded-pill bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            {card.nodes.length}
                          </span>
                        </span>
                      </div>

                      <div className="mx-3 mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
                        {STATUS_SEGMENTS.map((segment) => {
                          const count = card.nodes.filter((node) => node.status === segment.key).length
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
                          {card.nodes.map((node) => {
                            const isMultiSelected = isEditing && multiSelectedKeys.has(node.eqpKey)
                            return (
                              // 편집 모드에서 노드를 HTML5 드래그 소스로 — 카드 간 드롭 = 그룹 배정.
                              // Ctrl(⌘)+클릭 = 다중 선택 토글(선택된 노드 드래그 = 일괄 이동).
                              <div
                                key={node.eqpId}
                                draggable={isEditing}
                                onPointerDown={(event) => handleNodePointerDown(node.eqpKey, event)}
                                onClickCapture={(event) => handleNodeClickCapture(node.eqpKey, event)}
                                onDragStart={(event) => handleNodeDragStart(node.eqpKey, event)}
                                onDragEnd={handleNodeDragEnd}
                                data-multi-selected={isMultiSelected || undefined}
                                className={
                                  `${isEditing ? 'cursor-grab' : ''} ${
                                    isMultiSelected ? 'rounded-[7px] ring-2 ring-brand-primary/60' : ''
                                  }`.trim() || undefined
                                }
                              >
                                <LiveMapMachineNode
                                  eqpId={node.eqpId}
                                  status={node.status}
                                  portItems={node.portItems}
                                  selected={node.eqpId === selectedEquipment?.eqpId}
                                  dimmed={!visibleEquipmentIds.has(node.eqpId)}
                                  onSelect={onSelectEquipment}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* 우하단 리사이즈 핸들(편집 모드) — 미배정 그룹 포함 모든 카드. */}
                      {isEditing ? (
                        <div
                          data-testid={`live-map-flow-group-resize-${group.id}`}
                          onPointerDown={(event) => handleGroupResizePointerDown(group, event)}
                          className="absolute bottom-0 right-0 z-10 flex size-5 cursor-nwse-resize touch-none items-end justify-end p-0.75 text-muted-foreground hover:text-foreground"
                        >
                          <svg viewBox="0 0 10 10" className="size-full" aria-hidden="true">
                            <path
                              d="M9 1 L1 9 M9 5.5 L5.5 9"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              fill="none"
                            />
                          </svg>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="absolute left-4 top-4 inline-flex flex-col items-center gap-1.5 rounded-[16px] border border-border bg-card/80 px-1.5 py-2 shadow-soft-md backdrop-blur-sm">
            {canEdit ? (
              <>
                <RailButton
                  icon={SquarePen}
                  label={t('livemap.tool.move')}
                  active={isLayoutEditEnabled}
                  onClick={() => onLayoutEditEnabledChange(!isLayoutEditEnabled)}
                />
                <span className="my-0.5 h-px w-5 bg-border" />
              </>
            ) : null}
            <RailButton icon={Plus} label={t('livemap.zoom.in')} onClick={onZoomIn} />
            <RailButton icon={Minus} label={t('livemap.zoom.out')} onClick={onZoomOut} />
            <RailButton icon={Maximize2} label={t('livemap.zoom.reset')} onClick={onResetZoom} />
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

      {editingGroup ? (
        <LiveMapFlowGroupDialog
          key={editingGroup.id}
          group={groupIndex.get(editingGroup.id)?.group ?? editingGroup}
          onClose={() => setEditingGroup(null)}
          onSubmit={(patch) => {
            onUpdateGroup(editingGroup.id, patch)
            setEditingGroup(null)
          }}
        />
      ) : null}

      {arrowDialog ? (
        <LiveMapFlowArrowDialog
          key={arrowDialog.arrow?.id ?? 'create'}
          arrow={arrowDialog.arrow}
          groupOptions={groupOptions}
          onClose={() => setArrowDialog(null)}
          onSubmit={(patch) => {
            if (arrowDialog.arrow) {
              onUpdateArrow(arrowDialog.arrow.id, patch)
            } else {
              onCreateArrow(patch)
            }
            setArrowDialog(null)
          }}
          onDelete={
            arrowDialog.arrow
              ? () => {
                  if (arrowDialog.arrow) {
                    onDeleteArrow(arrowDialog.arrow.id)
                  }
                  setArrowDialog(null)
                }
              : undefined
          }
        />
      ) : null}

      <ConfirmDialog
        open={deletingGroup !== null}
        onOpenChange={(open) => (open ? undefined : setDeletingGroup(null))}
        title={t('livemap.flow.deleteGroup')}
        description={
          deletingGroup ? t('livemap.flow.deleteConfirm', { title: deletingGroup.title }) : null
        }
        confirmVariant="destructive"
        onConfirm={() => {
          if (deletingGroup) {
            onDeleteGroup(deletingGroup.id)
          }
          setDeletingGroup(null)
        }}
      />
    </section>
  )
}
