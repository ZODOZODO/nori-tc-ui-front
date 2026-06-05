import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { Circle, Group, Layer, Line, Rect, Shape, Stage, Text, Transformer } from 'react-konva'
import { Box, Image as ImageIcon, Minus, Square, Type } from 'lucide-react'
import type { RectConfig } from 'konva/lib/shapes/Rect'
import type { LineConfig } from 'konva/lib/shapes/Line'
import type { TextConfig } from 'konva/lib/shapes/Text'
import type { ContainerConfig } from 'konva/lib/Container'
import type { Transformer as KonvaTransformerNode } from 'konva/lib/shapes/Transformer'
import type { KonvaEventObject, Node as KonvaNodeRef } from 'konva/lib/Node'
import { useMe } from '@/features/profile/hooks/useProfile'
import { useLineList } from '@/shared/hooks/useLineList'
import { useLineScopeStore } from '@/shared/stores/line-scope.store'
import { hasPermission, LIVE_MAP_LAYOUT_WRITE_PERMISSION } from '@/shared/lib/permission'
import type { LiveMapEqpStatus, LiveMapPortStatus } from '../types/live-map.types'
import type { LiveMapEquipmentResponse } from '../api/live-map.api'
import { useLiveMap } from '../hooks/useLiveMap'
import type { LiveMapObjectResponse } from '../api/layout.api'
import {
  useCreateObject,
  useDeleteObject,
  useLayout,
  useLayoutObjects,
  useSaveLayout,
} from '../hooks/useLayout'
import {
  buildShapeJson,
  buildTransformJson,
  DEFAULT_CANVAS_JSON,
  DEFAULT_IMAGE_SRC,
  liftTransformsToFront,
  scaleTransform,
  sinkTransformsToBack,
  sortByDepth,
  toggleSelection,
  validatePlacementEqpBinding,
  type KonvaNode,
  type LiveMapObjectKind,
  type TransformJson,
} from '../lib/live-map-layout.model'
import { LIVE_MAP_BOARD_HEIGHT, LIVE_MAP_BOARD_WIDTH } from '../mocks/live-map.mock'
import {
  KonvaPrimitive,
  PrimitiveImage,
  type KonvaPrimitiveEditProps,
} from './LiveMapKonvaPrimitive'

// 빌더 저작 좌표계 = 뷰어 board 좌표계(1350×710). 그린 위치가 뷰어 표시 위치와 1:1 로 일치한다.
const STAGE_WIDTH = LIVE_MAP_BOARD_WIDTH
const STAGE_HEIGHT = LIVE_MAP_BOARD_HEIGHT
const DEFAULT_PLACE_X = 220
const DEFAULT_PLACE_Y = 160
const SCALE_STEP = 1.2

// 캔버스 표면(soft modern) — 살짝 밝은 다크 베이스 + 은은한 도트 그리드.
const CANVAS_BG = '#0e1422'
const GRID_GAP = 24
const GRID_DOT_COLOR = 'rgba(148, 163, 184, 0.16)'

type PrimitiveClassName = 'Rect' | 'Line' | 'Text' | 'Image'

/** 실시간 설비 상태 → Konva 채움색(hex). 캔버스는 tailwind 토큰이 아닌 raw 색이 필요. */
const STATUS_FILL: Record<LiveMapEqpStatus, string> = {
  RUN: '#22c55e',
  IDLE: '#0ea5e9',
  ERROR: '#ef4444',
  DOWN: '#64748b',
}

const PORT_STATUS_FILL: Record<LiveMapPortStatus, string> = {
  RUN: '#22c55e',
  IDLE: '#0ea5e9',
  DOWN: '#64748b',
}

interface WorkingPlacement {
  localId: string
  placementKey: number | null
  objectKey: number
  eqpKey: number | null
  transform: TransformJson
}

/** 캔버스에서 개별 편집되는 draft primitive. localId 로 선택/Transformer/삭제를 건다. */
interface DraftItem {
  localId: string
  node: KonvaNode
}

function createDraftPrimitive(className: PrimitiveClassName, index: number): KonvaNode {
  const offset = index * 16
  if (className === 'Rect') {
    return {
      className,
      attrs: {
        x: 96 + offset,
        y: 80 + offset,
        width: 132,
        height: 72,
        fill: 'rgba(59, 130, 246, 0.18)',
        stroke: '#3b82f6',
        strokeWidth: 1.5,
        cornerRadius: 10,
        shadowColor: '#000000',
        shadowBlur: 14,
        shadowOpacity: 0.35,
        shadowOffsetY: 4,
      },
    }
  }
  if (className === 'Line') {
    return {
      className,
      attrs: {
        points: [96 + offset, 180, 236 + offset, 180],
        stroke: '#60a5fa',
        strokeWidth: 3,
        lineCap: 'round',
        lineJoin: 'round',
      },
    }
  }
  if (className === 'Image') {
    return {
      className,
      attrs: { x: 96 + offset, y: 80 + offset, width: 72, height: 72, src: DEFAULT_IMAGE_SRC },
    }
  }
  return {
    className,
    attrs: {
      x: 96 + offset,
      y: 80 + offset,
      text: 'Label',
      fontSize: 18,
      fontStyle: '600',
      fill: '#e2e8f0',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
  }
}

const HEX6_PATTERN = /^#[0-9a-fA-F]{6}$/

/** color attr 을 <input type="color"> 가 받는 #rrggbb 로 보정한다(rgba/이름색은 fallback). */
const toColorInputValue = (value: unknown, fallback: string): string =>
  typeof value === 'string' && HEX6_PATTERN.test(value) ? value : fallback

/**
 * 2.5D 설비 프리셋 — 등각(isometric) 박스 3면(상단 밝음 / 좌 음영 / 우 짙은 음영) Line 폴리곤 + 라벨.
 *
 * <p>draft 로 주입한 뒤 "Save as Object"(EQUIPMENT)로 한 Group 에 묶는다. 실시간 상태 dot/포트는
 * eqp 바인딩 시 렌더 단계에서 오버레이되므로 도형 자체에는 포함하지 않는다.</p>
 */
function createIsoEquipmentNodes(): KonvaNode[] {
  const stroke = '#2b3340'
  const nodes: KonvaNode[] = [
    // 본체 3면 — 스틸/그레이 톤(상단 밝음 / 좌 중간 / 우 짙음). 파랑 아님.
    { className: 'Line', attrs: { points: [0, 38, 70, 76, 70, 150, 0, 112], closed: true, fill: '#9aa7b8', stroke, strokeWidth: 1.5 } },
    { className: 'Line', attrs: { points: [140, 38, 70, 76, 70, 150, 140, 112], closed: true, fill: '#6b7a8f', stroke, strokeWidth: 1.5 } },
    { className: 'Line', attrs: { points: [70, 0, 140, 38, 70, 76, 0, 38], closed: true, fill: '#d8dee9', stroke, strokeWidth: 1.5 } },
    // 상단 컨트롤 패널 + 스크린(시안 강조)
    { className: 'Line', attrs: { points: [70, 12, 118, 38, 70, 64, 22, 38], closed: true, fill: '#1f2937', stroke: '#0b1220', strokeWidth: 1 } },
    { className: 'Line', attrs: { points: [70, 23, 98, 38, 70, 53, 42, 38], closed: true, fill: '#155e75', stroke: '#22d3ee', strokeWidth: 1 } },
  ]
  // 우측(전면) 면에 포트 N개 — 면 basis(origin 70,76 / ax 70,-38 / ay 0,74)로 평행사변형 계산해 등각면에 맞춤.
  // 데모용 상태색; R4 에서 뷰어가 바인딩된 실설비 portItems 로 대체 예정.
  const port = (s: number, t: number): number[] => [70 + s * 70, 76 + s * -38 + t * 74]
  const portFills = ['#22c55e', '#22c55e', '#eab308', '#64748b']
  for (let i = 0; i < portFills.length; i += 1) {
    const s = 0.1 + i * 0.21
    const ds = 0.13
    const t = 0.58
    const dt = 0.2
    nodes.push({
      className: 'Line',
      attrs: {
        points: [...port(s, t), ...port(s + ds, t), ...port(s + ds, t + dt), ...port(s, t + dt)],
        closed: true,
        fill: portFills[i],
        stroke: '#0b1220',
        strokeWidth: 1,
      },
    })
  }
  nodes.push({ className: 'Text', attrs: { x: 54, y: 31, text: 'EQP', fontSize: 11, fontStyle: '700', fill: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' } })
  return nodes
}

/** 등각 박스 도형들을 1개 Group 노드로 묶는다 — 빌더에서 한 덩어리로 이동/저장되는 단위. */
function createIsoEquipmentGroupNode(): KonvaNode {
  return {
    className: 'Group',
    attrs: { x: DEFAULT_PLACE_X, y: DEFAULT_PLACE_Y },
    children: createIsoEquipmentNodes(),
  }
}

/**
 * live-map 2.5D 레이아웃 빌더 캔버스(react-konva)입니다.
 *
 * <p>저작(그리기/그룹화 저장/팔레트 배치/복사/리사이즈·회전/다중선택/z-order·배율/삭제/저장)은
 * admin 전용(`hasPermission(..., LIVE_MAP_LAYOUT_WRITE)`). 비-admin 은 캔버스 읽기 전용 —
 * 툴바/팔레트/우클릭 편집 메뉴가 렌더되지 않는다(이중 차단의 프론트 절반).</p>
 *
 * <p>EQUIPMENT 객체 배치는 라인 스코프 실설비를 골라 eqpKey 를 바인딩하고, `GET /live-map` 의
 * 실시간 상태(RUN/IDLE/ERROR/DOWN)·포트를 캔버스 노드에 오버레이한다(비-admin 도 상태 조회).</p>
 */
export function LiveMapLayoutCanvas() {
  const selectedLineValue = useLineScopeStore((state) => state.selectedLineValue)
  const lineListQuery = useLineList()
  const meQuery = useMe()
  const liveMapQuery = useLiveMap()

  const canEdit = hasPermission(meQuery.data?.permissionCodes, LIVE_MAP_LAYOUT_WRITE_PERMISSION)

  const lineKey = useMemo(
    () => lineListQuery.data?.find((line) => line.lineCode === selectedLineValue)?.lineKey ?? null,
    [lineListQuery.data, selectedLineValue],
  )

  const layoutQuery = useLayout(lineKey)
  const objectsQuery = useLayoutObjects(canEdit)
  const saveLayout = useSaveLayout(lineKey)
  const createObject = useCreateObject()
  const deleteObject = useDeleteObject()

  const idRef = useRef(0)
  const nextLocalId = () => {
    idRef.current += 1
    return `wp-${idRef.current}`
  }

  const nodeRefs = useRef(new Map<string, KonvaNodeRef>())
  const transformerRef = useRef<KonvaTransformerNode | null>(null)
  const fitObserverRef = useRef<ResizeObserver | null>(null)

  const [draft, setDraft] = useState<DraftItem[]>([])
  const [working, setWorking] = useState<WorkingPlacement[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; localId: string } | null>(null)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [objectName, setObjectName] = useState('')
  const [objectKind, setObjectKind] = useState<LiveMapObjectKind>('STRUCTURE')
  const [paletteSearch, setPaletteSearch] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  // 캔버스(board 좌표 1350×710)를 래퍼 폭에 맞춰 자동 축소 — 뷰어 board 와 동일한 fit-to-width.
  const [fitScale, setFitScale] = useState(1)

  // 서버 layout 이 바뀌면 작업 사본을 재시드(저장 후/라인 전환/새로고침 영속 반영).
  useEffect(() => {
    const placements = layoutQuery.data?.placements
    setSelectedIds([])
    if (!placements) {
      setWorking([])
      return
    }
    setWorking(
      placements.map((placement) => ({
        localId: nextLocalId(),
        placementKey: placement.placementKey,
        objectKey: placement.objectKey,
        eqpKey: placement.eqpKey,
        transform: placement.transformJson,
      })),
    )
    // layoutQuery.data 식별자가 바뀔 때만 재시드.
  }, [layoutQuery.data])

  // 캔버스 래퍼(권한/lineKey 에 따라 조건부 마운트)에 부착되는 콜백 ref — 마운트 시 폭을 관찰해
  // fit-to-width 배율을 측정/갱신한다(언마운트 시 observer 정리). 뷰어 board 와 동일한 폭 맞춤.
  const canvasWrapRef = useCallback((node: HTMLDivElement | null) => {
    fitObserverRef.current?.disconnect()
    if (!node) {
      return
    }
    const measure = () => setFitScale(Math.max(0.3, (node.clientWidth - 2) / STAGE_WIDTH))
    measure()
    fitObserverRef.current = new ResizeObserver(measure)
    fitObserverRef.current.observe(node)
  }, [])

  const objectsByKey = useMemo(() => {
    const map = new Map<number, LiveMapObjectResponse>()
    for (const object of layoutQuery.data?.objects ?? []) {
      map.set(object.objectKey, object)
    }
    for (const object of objectsQuery.data ?? []) {
      map.set(object.objectKey, object)
    }
    return map
  }, [layoutQuery.data?.objects, objectsQuery.data])

  // 실시간 상태 — eqpKey 로 GET /live-map 설비를 매칭. 라인 스코프 실설비 = eqp 바인딩 후보.
  const equipmentByKey = useMemo(() => {
    const map = new Map<number, LiveMapEquipmentResponse>()
    for (const equipment of liveMapQuery.data?.equipmentItems ?? []) {
      map.set(equipment.eqpKey, equipment)
    }
    return map
  }, [liveMapQuery.data?.equipmentItems])

  const lineEquipments = useMemo(
    () => (liveMapQuery.data?.equipmentItems ?? []).filter((equipment) => equipment.lineValue === selectedLineValue),
    [liveMapQuery.data?.equipmentItems, selectedLineValue],
  )

  const filteredObjects = useMemo(() => {
    const keyword = paletteSearch.trim().toLowerCase()
    const all = objectsQuery.data ?? []
    if (keyword.length === 0) {
      return all
    }
    return all.filter((object) => object.objectName.toLowerCase().includes(keyword))
  }, [objectsQuery.data, paletteSearch])

  const sortedWorking = useMemo(
    () =>
      sortByDepth(
        working.map((placement) => ({
          ...placement,
          depth: placement.transform.depth,
          zIndex: placement.transform.zIndex,
        })),
      ),
    [working],
  )

  // 선택 노드에 Transformer(리사이즈/회전 핸들) 부착 — react-konva 표준 패턴.
  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) {
      return
    }
    const nodes = selectedIds
      .map((id) => nodeRefs.current.get(id))
      .filter((node): node is KonvaNodeRef => Boolean(node))
    transformer.nodes(nodes)
    transformer.getLayer()?.batchDraw()
  }, [selectedIds, sortedWorking, draft])

  const addPrimitive = (className: PrimitiveClassName) => {
    setStatusMessage(null)
    const localId = nextLocalId()
    setDraft((previous) => [...previous, { localId, node: createDraftPrimitive(className, previous.length) }])
    // 추가 즉시 선택 → 캔버스에 도형이 나타나고 곧장 드래그/리사이즈/회전 핸들이 붙는다.
    setSelectedIds([localId])
  }

  // 2.5D Equipment 프리셋: 등각 박스를 "하나의 Group draft" 로 캔버스에 추가한다 — 통째로 드래그/리사이즈/회전
  // 되는 한 덩어리. 곧장 선택해 Transformer 핸들이 붙고, 위치를 잡은 뒤 "Save as Object"(EQUIPMENT)로 저장한다.
  const addIsoEquipmentPreset = () => {
    setStatusMessage(null)
    const localId = nextLocalId()
    setDraft((previous) => [...previous, { localId, node: createIsoEquipmentGroupNode() }])
    setSelectedIds([localId])
    setObjectKind('EQUIPMENT')
  }

  const handleConfirmSaveObject = () => {
    const trimmedName = objectName.trim()
    if (trimmedName.length === 0) {
      setStatusMessage('Object name is required.')
      return
    }
    // 그룹 draft 는 배치 시 placement 가 위치를 제공하므로 그룹 자신의 x/y 오프셋을 0 으로 정규화한다
    // (템플릿 원점 보존, placement+그룹 이중 오프셋 방지).
    const nodes = draft.map((item) =>
      item.node.className === 'Group'
        ? { ...item.node, attrs: { ...item.node.attrs, x: 0, y: 0 } }
        : item.node,
    )
    const shapeJson = buildShapeJson({ name: trimmedName }, nodes)
    createObject.mutate(
      { objectName: trimmedName, objectKind, shapeJson },
      {
        onSuccess: () => {
          setDraft([])
          setSelectedIds([])
          setObjectName('')
          setObjectKind('STRUCTURE')
          setIsSaveDialogOpen(false)
          setStatusMessage('Object saved.')
        },
        onError: (error) => setStatusMessage(error instanceof Error ? error.message : 'Save object failed.'),
      },
    )
  }

  const placeObject = (object: LiveMapObjectResponse, x: number, y: number) => {
    setStatusMessage(null)
    setWorking((previous) => [
      ...previous,
      {
        localId: nextLocalId(),
        placementKey: null,
        objectKey: object.objectKey,
        // EQUIPMENT 객체는 실설비 바인딩 필요 — 선택 후 binding 패널에서 라인 스코프 설비를 고른다.
        eqpKey: null,
        transform: buildTransformJson({ x, y, depth: previous.length, zIndex: previous.length }),
      },
    ])
  }

  const handlePaletteDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const objectKey = Number(event.dataTransfer.getData('text/plain'))
    if (!Number.isInteger(objectKey)) {
      return
    }
    const object = objectsByKey.get(objectKey)
    if (!object) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    placeObject(object, (event.clientX - rect.left) / fitScale, (event.clientY - rect.top) / fitScale)
  }

  const duplicatePlacement = (localId: string) => {
    setWorking((previous) => {
      const source = previous.find((placement) => placement.localId === localId)
      if (!source) {
        return previous
      }
      return [
        ...previous,
        {
          ...source,
          localId: nextLocalId(),
          placementKey: null,
          transform: {
            ...source.transform,
            x: source.transform.x + 28,
            y: source.transform.y + 28,
            depth: previous.length,
            zIndex: previous.length,
          },
        },
      ]
    })
    setContextMenu(null)
  }

  const deletePlacement = (localId: string) => {
    setWorking((previous) => previous.filter((placement) => placement.localId !== localId))
    setSelectedIds((current) => current.filter((id) => id !== localId))
    setContextMenu(null)
  }

  const deleteSelected = () => {
    setWorking((previous) => previous.filter((placement) => !selectedIds.includes(placement.localId)))
    setDraft((previous) => previous.filter((item) => !selectedIds.includes(item.localId)))
    setSelectedIds([])
  }

  // 캔버스에서 draft 도형을 드래그/리사이즈/회전한 결과를 해당 도형의 attrs 에 직접 반영한다.
  const updateDraftNode = (localId: string, attrs: Record<string, unknown>) => {
    setDraft((previous) =>
      previous.map((item) =>
        item.localId === localId
          ? { ...item, node: { ...item.node, attrs: { ...item.node.attrs, ...attrs } } }
          : item,
      ),
    )
  }

  const updatePosition = (localId: string, x: number, y: number) => {
    setWorking((previous) =>
      previous.map((placement) =>
        placement.localId === localId
          ? { ...placement, transform: { ...placement.transform, x, y } }
          : placement,
      ),
    )
  }

  const applyTransform = (
    localId: string,
    next: { x: number; y: number; rotation: number; scaleX: number; scaleY: number },
  ) => {
    setWorking((previous) =>
      previous.map((placement) =>
        placement.localId === localId
          ? { ...placement, transform: { ...placement.transform, ...next } }
          : placement,
      ),
    )
  }

  const selectedIndexSet = (): ReadonlySet<number> => {
    const set = new Set<number>()
    working.forEach((placement, index) => {
      if (selectedIds.includes(placement.localId)) {
        set.add(index)
      }
    })
    return set
  }

  const reorderSelected = (toFront: boolean) => {
    const indices = selectedIndexSet()
    const transforms = working.map((placement) => placement.transform)
    const reordered = toFront
      ? liftTransformsToFront(transforms, indices)
      : sinkTransformsToBack(transforms, indices)
    setWorking((previous) => previous.map((placement, index) => ({ ...placement, transform: reordered[index] })))
  }

  const scaleSelected = (factor: number) => {
    setWorking((previous) =>
      previous.map((placement) =>
        selectedIds.includes(placement.localId)
          ? { ...placement, transform: scaleTransform(placement.transform, factor) }
          : placement,
      ),
    )
  }

  const bindEqp = (localId: string, eqpKey: number | null) => {
    setStatusMessage(null)
    setWorking((previous) =>
      previous.map((placement) =>
        placement.localId === localId ? { ...placement, eqpKey } : placement,
      ),
    )
  }

  const handleSelectPlacement = (event: KonvaEventObject<MouseEvent>, localId: string) => {
    if (!canEdit) {
      return
    }
    // Konva 는 우클릭에도 click 을 발화한다 — 우클릭은 컨텍스트 메뉴 전담이라 선택에서 제외.
    if (event.evt.button === 2) {
      return
    }
    const additive = event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey
    setSelectedIds((previous) => toggleSelection(previous, localId, additive))
  }

  const handleSaveLayout = () => {
    for (const placement of working) {
      const object = objectsByKey.get(placement.objectKey)
      if (!object) {
        continue
      }
      const violation = validatePlacementEqpBinding(object.objectKind, placement.eqpKey)
      if (violation) {
        setStatusMessage(violation)
        return
      }
    }
    saveLayout.mutate(
      {
        canvasJson: layoutQuery.data?.canvasJson ?? DEFAULT_CANVAS_JSON,
        placements: working.map((placement) => ({
          objectKey: placement.objectKey,
          eqpKey: placement.eqpKey,
          transformJson: placement.transform,
        })),
      },
      {
        onSuccess: () => setStatusMessage('Layout saved.'),
        onError: (error) => setStatusMessage(error instanceof Error ? error.message : 'Save layout failed.'),
      },
    )
  }

  const singleSelected =
    selectedIds.length === 1 ? working.find((placement) => placement.localId === selectedIds[0]) ?? null : null
  const singleSelectedObject = singleSelected ? objectsByKey.get(singleSelected.objectKey) ?? null : null
  const isEquipmentSelected = singleSelectedObject?.objectKind === 'EQUIPMENT'
  const singleSelectedStatus =
    singleSelected?.eqpKey != null ? equipmentByKey.get(singleSelected.eqpKey)?.status ?? null : null
  // working 배치 전용 액션(z-order/Scale±/eqp 바인딩)은 working 이 선택됐을 때만 노출 — draft 선택 시 무력 버튼 회피.
  const hasWorkingSelected = working.some((placement) => selectedIds.includes(placement.localId))

  // 단일 draft 선택 시 색(fill/stroke) 편집 — working 배치는 저장된 객체라 색은 저작 단계(draft)에서만 바꾼다.
  const singleSelectedDraft =
    selectedIds.length === 1 ? draft.find((item) => item.localId === selectedIds[0]) ?? null : null
  const draftClassName = singleSelectedDraft?.node.className
  const draftSupportsFill =
    draftClassName === 'Rect' || draftClassName === 'Text' || draftClassName === 'Line'
  const draftSupportsStroke = draftClassName === 'Rect' || draftClassName === 'Line'
  const draftFillValue = toColorInputValue(singleSelectedDraft?.node.attrs.fill, '#3b82f6')
  const draftStrokeValue = toColorInputValue(singleSelectedDraft?.node.attrs.stroke, '#1e293b')

  if (lineKey === null) {
    return (
      <div
        data-testid="builder-select-line-hint"
        className="rounded-[18px] border border-border bg-card px-4 py-6 text-sm font-semibold text-muted-foreground"
      >
        Select a single line from the top bar to view or edit its 2.5D layout.
      </div>
    )
  }

  // draft primitive 를 캔버스에 직접 드래그 가능한 Konva 노드로 렌더한다(working 배치와 달리 Group 미경유,
  // 위치/크기/회전을 노드 자신의 attrs 에 보관 → Save as Object 직렬화가 그대로 동작).
  const renderDraftNode = (item: DraftItem) => {
    const attrs = item.node.attrs
    const editProps: KonvaPrimitiveEditProps = {
      ref: (node) => {
        if (node) {
          nodeRefs.current.set(item.localId, node)
        } else {
          nodeRefs.current.delete(item.localId)
        }
      },
      draggable: canEdit,
      onClick: (event) => handleSelectPlacement(event, item.localId),
      onTap: () => canEdit && setSelectedIds([item.localId]),
      onDragEnd: (event) => updateDraftNode(item.localId, { x: event.target.x(), y: event.target.y() }),
      onTransformEnd: (event) =>
        updateDraftNode(item.localId, {
          x: event.target.x(),
          y: event.target.y(),
          rotation: event.target.rotation(),
          scaleX: event.target.scaleX(),
          scaleY: event.target.scaleY(),
        }),
    }
    switch (item.node.className) {
      case 'Rect':
        return <Rect key={item.localId} {...editProps} {...(attrs as RectConfig)} />
      case 'Line':
        return <Line key={item.localId} {...editProps} {...(attrs as LineConfig)} />
      case 'Text':
        return <Text key={item.localId} {...editProps} {...(attrs as TextConfig)} />
      case 'Image':
        return <PrimitiveImage key={item.localId} attrs={attrs} nodeProps={editProps} />
      case 'Group':
        return (
          <Group key={item.localId} {...editProps} {...(attrs as ContainerConfig)}>
            {(item.node.children ?? []).map((child, index) => (
              <KonvaPrimitive key={`${item.localId}-${index}`} node={child} />
            ))}
          </Group>
        )
      default:
        return null
    }
  }

  const stage = (
    <Stage width={STAGE_WIDTH * fitScale} height={STAGE_HEIGHT * fitScale}>
      <Layer scaleX={fitScale} scaleY={fitScale}>
        <Rect
          x={0}
          y={0}
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          fill={CANVAS_BG}
          onClick={() => {
            setSelectedIds([])
            setContextMenu(null)
          }}
        />
        <Shape
          listening={false}
          fill={GRID_DOT_COLOR}
          sceneFunc={(context, shape) => {
            context.beginPath()
            for (let x = GRID_GAP; x < STAGE_WIDTH; x += GRID_GAP) {
              for (let y = GRID_GAP; y < STAGE_HEIGHT; y += GRID_GAP) {
                context.moveTo(x + 1, y)
                context.arc(x, y, 1, 0, Math.PI * 2)
              }
            }
            context.fillStrokeShape(shape)
          }}
        />
        {sortedWorking.map((placement) => {
          const object = objectsByKey.get(placement.objectKey)
          if (!object) {
            return null
          }
          const transform = placement.transform
          const isEquipment = object.objectKind === 'EQUIPMENT'
          const equipment = placement.eqpKey != null ? equipmentByKey.get(placement.eqpKey) ?? null : null
          return (
            <Group
              key={placement.localId}
              ref={(node) => {
                if (node) {
                  nodeRefs.current.set(placement.localId, node)
                } else {
                  nodeRefs.current.delete(placement.localId)
                }
              }}
              x={transform.x}
              y={transform.y}
              rotation={transform.rotation}
              scaleX={transform.scaleX}
              scaleY={transform.scaleY}
              skewX={transform.skewX}
              skewY={transform.skewY}
              draggable={canEdit}
              onClick={(event) => handleSelectPlacement(event, placement.localId)}
              onTap={() => canEdit && setSelectedIds([placement.localId])}
              onDragEnd={(event) => updatePosition(placement.localId, event.target.x(), event.target.y())}
              onTransformEnd={(event) =>
                applyTransform(placement.localId, {
                  x: event.target.x(),
                  y: event.target.y(),
                  rotation: event.target.rotation(),
                  scaleX: event.target.scaleX(),
                  scaleY: event.target.scaleY(),
                })
              }
              onContextMenu={(event) => {
                if (!canEdit) {
                  return
                }
                // 우클릭은 컨텍스트 메뉴만 연다 — 선택(selectedIds)·selection bar 는 좌클릭 전담.
                // (우클릭 시 selectedIds 를 바꾸면 selection bar 가 떠 레이아웃이 밀리고 메뉴가 닫힌다.)
                event.evt.preventDefault()
                setContextMenu({ x: event.evt.offsetX, y: event.evt.offsetY, localId: placement.localId })
              }}
            >
              {(object.shapeJson.root.children ?? []).map((child, index) => (
                <KonvaPrimitive key={`${placement.localId}-${index}`} node={child} />
              ))}
              {isEquipment && equipment ? (
                <>
                  <Circle x={-2} y={-2} radius={6} fill={STATUS_FILL[equipment.status]} stroke="#0b0f1a" strokeWidth={1} />
                  <Text x={8} y={-18} text={equipment.status} fontSize={11} fill={STATUS_FILL[equipment.status]} />
                  {equipment.portItems.map((port, portIndex) => (
                    <Circle
                      key={`${placement.localId}-port-${port.id}`}
                      x={6 + portIndex * 12}
                      y={84}
                      radius={4}
                      fill={PORT_STATUS_FILL[port.status]}
                    />
                  ))}
                </>
              ) : null}
            </Group>
          )
        })}
        {draft.map((item) => renderDraftNode(item))}
        {canEdit && selectedIds.length > 0 ? (
          <Transformer ref={transformerRef} rotateEnabled resizeEnabled ignoreStroke />
        ) : null}
      </Layer>
    </Stage>
  )

  if (!canEdit) {
    return (
      <section
        className="flex flex-col gap-3 rounded-[24px] border border-border bg-card p-5 shadow-soft-lg"
        data-testid="live-map-builder"
      >
        <div
          data-testid="live-map-builder-readonly"
          className="rounded-[12px] border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground"
        >
          Read-only — layout editing requires the LIVE_MAP_LAYOUT_WRITE permission.
        </div>
        <div
          ref={canvasWrapRef}
          data-testid="live-map-builder-canvas"
          className="overflow-auto rounded-[18px] border border-border bg-[#0e1422]"
        >
          {stage}
        </div>
      </section>
    )
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-[24px] border border-border bg-card p-5 shadow-soft-lg"
      data-testid="live-map-builder"
    >
      <div
        data-testid="live-map-builder-toolbar"
        className="flex flex-wrap items-center gap-2 rounded-[12px] border border-border bg-card px-3 py-2"
      >
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5" role="group" aria-label="Add shape">
          <button type="button" data-testid="builder-add-rect" title="Add Rectangle" aria-label="Add Rectangle" className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => addPrimitive('Rect')}>
            <Square className="size-4" aria-hidden="true" />
          </button>
          <button type="button" data-testid="builder-add-line" title="Add Line" aria-label="Add Line" className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => addPrimitive('Line')}>
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <button type="button" data-testid="builder-add-text" title="Add Text" aria-label="Add Text" className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => addPrimitive('Text')}>
            <Type className="size-4" aria-hidden="true" />
          </button>
          <button type="button" data-testid="builder-add-image" title="Add Image" aria-label="Add Image" className="flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => addPrimitive('Image')}>
            <ImageIcon className="size-4" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          data-testid="builder-add-equipment"
          title="Add 2.5D Equipment"
          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          onClick={addIsoEquipmentPreset}
        >
          <Box className="size-4" aria-hidden="true" />
          2.5D Equipment
        </button>
        <button
          type="button"
          data-testid="builder-save-object"
          className="rounded-md border border-primary px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-40"
          disabled={draft.length === 0}
          onClick={() => setIsSaveDialogOpen(true)}
        >
          Save as Object
        </button>
        <button type="button" data-testid="builder-save-layout" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground" onClick={handleSaveLayout}>
          Save Layout
        </button>
        <span className="ml-2 text-xs text-muted-foreground">
          draft <span data-testid="builder-draft-count">{draft.length}</span> · placements{' '}
          <span data-testid="builder-placement-count">{working.length}</span> · selected{' '}
          <span data-testid="builder-selected-count">{selectedIds.length}</span>
        </span>
      </div>

      <div className="relative">
        {/* 팔레트는 캔버스를 board(뷰어)와 같은 전체 폭으로 두기 위해 떠 있는 오버레이로 띄운다(뷰어 줌레일과 동일 패턴).
            우상단 배치 — 기본 배치 원점/저작 영역이 좌측이라 충돌을 피한다. */}
        <div
          data-testid="live-map-builder-palette"
          className="absolute right-4 top-4 z-10 flex max-h-[calc(100%-2rem)] w-56 flex-col gap-1.5 overflow-auto rounded-[18px] border border-border bg-card/90 p-3 shadow-soft-md backdrop-blur-sm"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Object Palette</span>
          <input
            data-testid="palette-search"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            placeholder="Search objects…"
            value={paletteSearch}
            onChange={(event) => setPaletteSearch(event.target.value)}
          />
          {filteredObjects.length === 0 ? (
            <span className="text-xs text-muted-foreground">No matching objects.</span>
          ) : (
            filteredObjects.map((object) => (
              <div
                key={object.objectKey}
                data-testid={`palette-item-${object.objectKey}`}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', String(object.objectKey))}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
              >
                <button
                  type="button"
                  data-testid={`palette-place-${object.objectKey}`}
                  className="flex-1 truncate text-left text-xs font-semibold"
                  title={`${object.objectName} (${object.objectKind})`}
                  onClick={() => placeObject(object, DEFAULT_PLACE_X, DEFAULT_PLACE_Y)}
                >
                  {object.objectName}
                </button>
                <button
                  type="button"
                  data-testid={`palette-delete-${object.objectKey}`}
                  className="text-[11px] text-danger"
                  onClick={() => deleteObject.mutate(object.objectKey)}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div className="relative">
          <div
            ref={canvasWrapRef}
            data-testid="live-map-builder-canvas"
            className="relative overflow-auto rounded-[18px] border border-border bg-[#0e1422]"
            onClick={() => setContextMenu(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handlePaletteDrop}
          >
            {stage}
            {contextMenu ? (
              <div
                data-testid="placement-context-menu"
                className="absolute z-10 w-32 rounded-md border border-border bg-card py-1 shadow-soft-sm"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                <button
                  type="button"
                  data-testid="context-copy"
                  className="block w-full px-3 py-1.5 text-left text-xs font-semibold hover:bg-muted"
                  onClick={() => duplicatePlacement(contextMenu.localId)}
                >
                  Copy
                </button>
                <button
                  type="button"
                  data-testid="context-delete"
                  className="block w-full px-3 py-1.5 text-left text-xs font-semibold text-danger hover:bg-muted"
                  onClick={() => deletePlacement(contextMenu.localId)}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>

          {/* 선택 액션바는 캔버스 위에 떠 있는 overlay — 선택/해제 시 아래 레이아웃을 밀지 않는다(레이아웃 점프 방지). */}
          {selectedIds.length > 0 ? (
            <div
              data-testid="builder-selection-bar"
              className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border border-primary/40 bg-card/95 px-3 py-1.5 shadow-soft-lg backdrop-blur"
            >
              {hasWorkingSelected ? (
                <>
                  <button type="button" data-testid="selection-front" className="rounded-full border border-border px-3 py-1 text-xs font-semibold" onClick={() => reorderSelected(true)}>
                    Bring to Front
                  </button>
                  <button type="button" data-testid="selection-back" className="rounded-full border border-border px-3 py-1 text-xs font-semibold" onClick={() => reorderSelected(false)}>
                    Send to Back
                  </button>
                  <button type="button" data-testid="selection-scale-up" className="rounded-full border border-border px-3 py-1 text-xs font-semibold" onClick={() => scaleSelected(SCALE_STEP)}>
                    Scale +
                  </button>
                  <button type="button" data-testid="selection-scale-down" className="rounded-full border border-border px-3 py-1 text-xs font-semibold" onClick={() => scaleSelected(1 / SCALE_STEP)}>
                    Scale −
                  </button>
                </>
              ) : null}
              <button type="button" data-testid="selection-delete" className="rounded-full border border-danger px-3 py-1 text-xs font-semibold text-danger" onClick={deleteSelected}>
                Delete
              </button>

              {singleSelectedDraft ? (
                <span data-testid="draft-color-controls" className="flex items-center gap-2 text-xs font-semibold">
                  {draftSupportsFill ? (
                    <label className="flex items-center gap-1">
                      <span className="text-muted-foreground">Fill</span>
                      <input
                        type="color"
                        data-testid="draft-fill-color"
                        value={draftFillValue}
                        onChange={(event) => updateDraftNode(singleSelectedDraft.localId, { fill: event.target.value })}
                        className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                      />
                    </label>
                  ) : null}
                  {draftSupportsStroke ? (
                    <label className="flex items-center gap-1">
                      <span className="text-muted-foreground">Stroke</span>
                      <input
                        type="color"
                        data-testid="draft-stroke-color"
                        value={draftStrokeValue}
                        onChange={(event) => updateDraftNode(singleSelectedDraft.localId, { stroke: event.target.value })}
                        className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent p-0"
                      />
                    </label>
                  ) : null}
                </span>
              ) : null}

              {isEquipmentSelected && singleSelected ? (
                <span data-testid="placement-eqp-binding" className="flex items-center gap-2 text-xs font-semibold">
                  <span className="text-muted-foreground">Equipment</span>
                  <select
                    data-testid="placement-eqp-select"
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                    value={singleSelected.eqpKey ?? ''}
                    onChange={(event) =>
                      bindEqp(singleSelected.localId, event.target.value === '' ? null : Number(event.target.value))
                    }
                  >
                    <option value="">— select equipment —</option>
                    {lineEquipments.map((equipment) => (
                      <option key={equipment.eqpKey} value={equipment.eqpKey}>
                        {equipment.eqpName}
                      </option>
                    ))}
                  </select>
                  <span data-testid="placement-eqp-status" className="text-muted-foreground">
                    {singleSelectedStatus ?? 'unbound'}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}

          {statusMessage ? (
            <div
              data-testid="builder-status"
              className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-soft-sm backdrop-blur"
            >
              {statusMessage}
            </div>
          ) : null}
        </div>
      </div>

      {isSaveDialogOpen ? (
        <div data-testid="object-save-dialog" className="flex flex-wrap items-end gap-2 rounded-[18px] border border-primary/40 bg-card p-3">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Object name
            <input
              data-testid="object-name-input"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              value={objectName}
              onChange={(event) => setObjectName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Kind
            <select
              data-testid="object-kind-select"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              value={objectKind}
              onChange={(event) => setObjectKind(event.target.value as LiveMapObjectKind)}
            >
              <option value="STRUCTURE">STRUCTURE</option>
              <option value="EQUIPMENT">EQUIPMENT</option>
            </select>
          </label>
          <button type="button" data-testid="object-save-confirm" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground" onClick={handleConfirmSaveObject}>
            Save
          </button>
          <button type="button" className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold" onClick={() => setIsSaveDialogOpen(false)}>
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  )
}
