import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SELECT_EMPTY_VALUE,
} from '@/components/ui/select'
import { useI18n } from '@/i18n/i18n-context'
import { useMe } from '@/features/profile/hooks/useProfile'
import { hasPermission, LIVE_MAP_LAYOUT_WRITE_PERMISSION } from '@/shared/lib/permission'
import { useLineScopeStore } from '@/shared/stores/line-scope.store'
import { useThemeStore } from '@/shared/stores/theme.store'
import type { LiveMapObjectResponse, LiveMapPlacementResponse } from '../api/layout.api'
import type { LiveMapEquipmentResponse as LiveMapEquipment } from '../api/live-map.api'
import { useCreateObject, useLayout, useLayoutObjects, useSaveLayout } from '../hooks/useLayout'
import { useLiveMap } from '../hooks/useLiveMap'
import { buildLiveMapEquipmentNodes } from '../lib/live-map-data'
import { createSelectionEdgesGeometry, SELECTION_BOX_INFLATE } from '../lib/selection-box-geometry'
import { buildTransformJson, DEFAULT_CANVAS_JSON, type ShapeJson } from '../lib/live-map-layout.model'
import {
  buildDefaultStructureLayout,
  isBuiltinStructureKey,
  isLiveMap3DShape,
  LIVE_MAP_BOARD_PX_HEIGHT,
  LIVE_MAP_BOARD_PX_WIDTH,
  LIVE_MAP_BUILTIN_STRUCTURES,
  LIVE_MAP_FAB_LINE_LAYOUT,
  LIVE_MAP_SCENE_PALETTE,
  LIVE_MAP_STATUS_COLOR,
  LIVE_MAP_STRUCTURE_COLOR_BY_NAME,
  placementToWorld,
  planEquipmentLineLayout,
  shapeBoundingBox,
  snapToGrid,
  worldToPlacement,
  type LiveMap3DShape,
  type LiveMapBuiltinStructure,
  type LiveMapScenePalette,
} from '../lib/live-map-3d.model'
import { useEqpList } from '@/features/eqp/hooks/useEqpList'
import { useGatewayShardLeases } from '@/features/eqp/hooks/useGatewayShardLeases'
import { groupEqpItems } from '@/features/eqp/utils/eqp-group.util'
import { LiveMap3DEquipmentField, type FieldPlacement } from './LiveMap3DEquipmentField'
import { LiveMap3DObject } from './LiveMap3DObject'
import { LiveMapTooltipCard } from './LiveMapTooltipCard'

interface LiveMap3DSceneProps {
  lineKey: number | null
}

interface WorkingPlacement {
  localId: string
  placementKey: number | null
  objectKey: number
  eqpKey: number | null
  xPx: number
  yPx: number
  rotationDeg: number
  floor: number
}

interface ResolvedPlacement extends WorkingPlacement {
  kind: LiveMapObjectResponse['objectKind']
  shape: LiveMap3DShape
  equipment: LiveMapEquipment | null
  objectName: string | null
}

/** 서버 placement → 편집 버퍼(working) 항목. 로드된 working 과 변경 기준선(baseline)이 같은 매핑을 쓰도록 단일 출처로 둔다.
 *  저장된 항목은 placementKey 기반 결정적 localId(wp-saved-*), 미저장 로드는 인덱스 기반(wp-loaded-*) — 편집 중 추가분(wp-*)과 prefix 가 달라 충돌하지 않는다. */
const toWorkingPlacement = (placement: LiveMapPlacementResponse, index: number): WorkingPlacement => ({
  localId: placement.placementKey !== null ? `wp-saved-${placement.placementKey}` : `wp-loaded-${index}`,
  placementKey: placement.placementKey,
  objectKey: placement.objectKey,
  eqpKey: placement.eqpKey,
  xPx: placement.transformJson.x,
  yPx: placement.transformJson.y,
  rotationDeg: placement.transformJson.rotation,
  floor: placement.transformJson.floor ?? 1,
})

const ROTATE_STEP = 15
/** 키보드 화살표 미세 이동 단위(px). Shift 동반 시 거친 단위. */
const NUDGE_PX = 8
const NUDGE_COARSE_PX = 40
/** 미배치 설비 추가 시 초기 staging 격자(겹침 방지) — 사용자가 끌어 bay 에 배치한다. */
const ADD_EQP_COLS = 6
const ADD_EQP_PITCH_PX = 260
/** 층 — 1~2층, 층간 높이(world unit). 설비(~4 높이) 위로 충분한 여유(뱃지/시그널타워 안 겹치게) + 층 구분 강조. */
const FLOOR_LEVELS = [1, 2] as const
const FLOOR_HEIGHT = 9
/** 전체 보기에서 카메라 타깃을 층 스택 중앙으로 — 3층까지 화면에 들어오게. */
const STACK_CENTER_Y = (FLOOR_HEIGHT * (FLOOR_LEVELS.length - 1)) / 2
/** 층 뷰 — 특정 층만 보기 or 전체 적층. */
type FloorView = number | 'all'

/** 선택된 뱃지 — 상태색 배경 위 전경색. 상태색이 채도 높은 hex 라 테마 무관 순백이 대비 짝이다. */
const SELECTED_BADGE_FG = '#ffffff'

/** objectKey 0 = 라이브러리 객체 없이 자동 표시되는 빌트인 설비. 저장 시 백킹 EQUIPMENT 객체 키로 치환. */
const AUTO_OBJECT_KEY = 0
/** 설비(EQUIPMENT)는 빌트인 캐비닛으로 그려 shape 불요 — 자리만 채우는 빈 v2. */
const EMPTY_SHAPE: LiveMap3DShape = { v: 2, prims: [] }
/** 자동 표시 설비를 저장할 때 쓰는 공용 백킹 객체(없으면 1회 생성). */
const BUILTIN_EQUIPMENT_NAME = '기본 설비'
const BUILTIN_EQUIPMENT_SHAPE: LiveMap3DShape = {
  v: 2,
  prims: [{ id: 'body', type: 'box', size: { x: 2, y: 3, z: 1.2 }, position: { x: 0, y: 1.5, z: 0 }, rotationY: 0, color: '#3a4554' }],
}

/** 빌트인 구조물(벽/파티션)을 목록/렌더가 쓰는 객체 형태로 — DB row 없이 음수 키로 노출. */
const builtinAsObject = (builtin: LiveMapBuiltinStructure): LiveMapObjectResponse => ({
  objectKey: builtin.objectKey,
  objectName: builtin.objectName,
  objectKind: 'STRUCTURE',
  shapeJson: builtin.shapeJson as unknown as ShapeJson,
  isActive: true,
})

/** 층 뷰에 맞춰 카메라 줌/타깃을 보정 — 전체는 줌아웃+스택 중앙, 단일층은 줌인+바닥. (Canvas 재마운트 없이 imperative) */
function CameraRig({ floorView }: { floorView: FloorView }) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as { target: THREE.Vector3; update: () => void } | null
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    const orthographic = camera as THREE.OrthographicCamera
    // r3f 카메라 제어는 인스턴스 직접 변형이 정식 API — react-compiler immutability 오탐.
    // eslint-disable-next-line react-hooks/immutability
    orthographic.zoom = floorView === 'all' ? 14 : 20
    orthographic.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, floorView === 'all' ? STACK_CENTER_Y : 0, 0)
      controls.update()
    }
    invalidate()
  }, [floorView, camera, controls, invalidate])
  return null
}

/** 설비 선택 표시 박스의 크기/중심(world unit) — 본체+EFEM+시그널타워를 감싼다. */
const EQUIPMENT_SELECT_BOX = { center: [0, 1.55, 0.1] as const, size: [2.4, 3.15, 2.15] as const }

/**
 * 선택 강조 — 객체를 감싸는 와이어 박스(모서리 라인). 바닥 평면 링은 바닥/기둥/설비에 가려 안 보였으므로,
 * 객체 크기에 맞춘 박스 외곽선으로 어느 객체든(바닥=납작 사각, 기둥=세로 박스, 설비=툴 박스) 선택이 보이게 한다.
 * depthTest=false 라 다른 객체 뒤에 있어도 외곽선이 비쳐 항상 보인다. 상위 group 의 위치/회전을 그대로 따른다.
 */
function SelectionBox({
  center,
  size,
}: {
  center: readonly [number, number, number]
  size: readonly [number, number, number]
}) {
  // 살짝 부풀려(SELECTION_BOX_INFLATE) 객체 표면에 딱 붙지 않고 또렷이 감싸게 한다. WebGL 선은 두께가 1px
  // 고정이라 외곽선만으론 옅어, 반투명 채움(시안 글로우 볼륨)을 같이 둬 어느 줌/각도에서도 선택이 확실히 보이게 한다.
  // 의존성은 `size` 배열이 아니라 치수 3개다 — 구조물 호출부가 매 렌더 새 배열 리터럴을 넘기므로
  // 배열 identity 에 의존하면 memo 가 매 렌더 무효화돼 geometry 가 프레임마다 새로 쌓인다(S09 D-4).
  const [sizeX, sizeY, sizeZ] = size
  const edges = useMemo(
    () => createSelectionEdgesGeometry([sizeX, sizeY, sizeZ]),
    [sizeX, sizeY, sizeZ],
  )
  // r3f 는 prop 주입 geometry 를 자동 해제하지 않는다 → 치수 변경·언마운트 시 직접 해제.
  useEffect(() => () => edges.dispose(), [edges])
  return (
    <group position={[center[0], center[1], center[2]]}>
      <mesh>
        <boxGeometry
          args={[
            size[0] + SELECTION_BOX_INFLATE,
            size[1] + SELECTION_BOX_INFLATE,
            size[2] + SELECTION_BOX_INFLATE,
          ]}
        />
        {/* 반투명 채움 — depthWrite=false 라 객체를 가리지 않고 시안으로 감싼다. */}
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {/* 외곽선 — depthTest=false 라 다른 객체 뒤에 있어도 비쳐 항상 보인다. */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#06b6d4" transparent opacity={1} depthTest={false} />
      </lineSegments>
    </group>
  )
}

/** 뱃지를 씬 경계 안으로 유지하는 여백(px) — 가장자리 설비의 뱃지가 씬 밖으로 새어 클릭 불가가 되지 않게. */
const BADGE_EDGE_MARGIN = 26

/** 뱃지 좌표 투영 — N개 설비의 3D 위치를 화면 px 로 project 해 Canvas 밖 단일 오버레이의 버튼 transform 을 일괄 갱신.
 *  drei Html 포털 N개(O(N) 비용) 대신 plain 버튼 N개 + 이 projector 1개 → 진입 비용↓. frameloop=demand 라 카메라 변화/드래그(invalidate) 시 갱신. */
function BadgeProjector({
  equip,
  badgeRefs,
}: {
  equip: FieldPlacement[]
  badgeRefs: RefObject<Map<string, HTMLButtonElement | null>>
}) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const vecRef = useRef(new THREE.Vector3())
  useFrame(() => {
    const width = gl.domElement.clientWidth
    const height = gl.domElement.clientHeight
    const vec = vecRef.current
    for (const p of equip) {
      const el = badgeRefs.current?.get(p.localId)
      if (!el) {
        continue
      }
      vec.set(p.worldX, p.floorY + 3.7, p.worldZ)
      vec.project(camera)
      // 설비를 씬 가장자리로 옮기면 뱃지(+3.7 띄움)가 씬 밖(상단바 등)으로 투영돼 클릭 불가가 된다 →
      // 씬 안으로 clamp 해 드래그/재선택 핸들을 항상 잡을 수 있게 유지(선택링은 3D 상 설비 위치 그대로).
      const x = Math.max(BADGE_EDGE_MARGIN, Math.min(width - BADGE_EDGE_MARGIN, (vec.x * 0.5 + 0.5) * width))
      const y = Math.max(BADGE_EDGE_MARGIN, Math.min(height - BADGE_EDGE_MARGIN, (-vec.y * 0.5 + 0.5) * height))
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
    }
  })
  return null
}

/** Canvas 내부 — 다중 선택 + 그룹 바닥 드래그(수동 ray-plane + 포인터 캡처) + 층 슬래브. 뱃지는 Canvas 밖 단일 오버레이. */
function SceneContent({
  placements,
  selectedIdSet,
  editing,
  palette,
  floorView,
  badgeRefs,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  beginDragRef,
}: {
  placements: ResolvedPlacement[]
  selectedIdSet: ReadonlySet<string>
  editing: boolean
  palette: LiveMapScenePalette
  floorView: FloorView
  badgeRefs: RefObject<Map<string, HTMLButtonElement | null>>
  onSelect: (localId: string, additive: boolean) => void
  onDragStart: (localId: string) => void
  onDragMove: (localId: string, worldX: number, worldZ: number) => void
  onDragEnd: () => void
  beginDragRef: RefObject<((localId: string, pointerId: number, planeY: number) => void) | null>
}) {
  // 단일 층 보기는 그 층을 바닥(Y=0)으로 평탄화해 포커스 — 전체 보기는 층별 Y 로 적층.
  const floorYOf = (floor: number) => (floorView === 'all' ? (floor - 1) * FLOOR_HEIGHT : 0)
  const { gl, camera, raycaster } = useThree()
  const dragRef = useRef<{ localId: string; pointerId: number } | null>(null)
  // 드래그 평면 — 대상 placement 의 층 높이에 맞춰 constant 를 갱신(상층 드래그 시 cursor 정합). ref(허용된 mutable 컨테이너).
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  useEffect(() => {
    const element = gl.domElement
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) {
        return
      }
      const rect = element.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(ndc, camera)
      const hit = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(dragPlaneRef.current, hit)) {
        onDragMove(drag.localId, hit.x, hit.z)
      }
    }
    const handleUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null
        onDragEnd()
      }
    }
    // 드래그 이동/종료는 window 에서 듣는다(포인터 캡처 미사용) — gl.domElement 에 직접 setPointerCapture 하면
    // r3f 자체 이벤트 시스템의 캡처 관리와 충돌해, 한 번 드래그한 뒤 캔버스 raycast 픽이 죽는다(재선택 불가). window 리스너는
    // 포인터가 캔버스를 벗어나도 잡고, r3f 이벤트 시스템을 전혀 건드리지 않는다.
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [gl, camera, raycaster, onDragMove, onDragEnd])

  // 뱃지(Canvas 밖 HTML)로 설비를 끌 때, 설비 메시 드래그와 동일한 경로로 통합한다 — dragRef 를 세팅하면
  // window 의 pointermove/up/cancel 리스너가 이동/종료를 처리한다(포인터 캡처 미사용).
  useEffect(() => {
    beginDragRef.current = (localId, pointerId, planeY) => {
      dragPlaneRef.current.constant = -planeY
      dragRef.current = { localId, pointerId }
    }
    return () => {
      beginDragRef.current = null
    }
  }, [beginDragRef])

  const beginInteract = useCallback(
    (localId: string, floorY: number, event: ThreeEvent<PointerEvent>) => {
      const additive = event.shiftKey || event.ctrlKey || event.metaKey
      onSelect(localId, additive)
      // Shift/Ctrl = 다중 선택 토글이므로 드래그 시작 안 함. 비-additive 클릭만 드래그.
      if (!editing || additive) {
        return
      }
      event.stopPropagation()
      // 포인터 캡처는 걸지 않는다 — window 리스너가 이동/종료를 처리하고, 직접 캡처 시 r3f 이벤트 시스템과 충돌해
      // 드래그 후 재픽이 죽는다(아래 useEffect 주석 참고).
      dragPlaneRef.current.constant = -floorY
      dragRef.current = { localId, pointerId: event.pointerId }
      onDragStart(localId)
    },
    [onSelect, editing, onDragStart],
  )

  // 보이는 층만 렌더. 설비는 InstancedMesh 필드로 일괄(부품 종류당 1 draw call, 설비 수 무관), 구조물은 소수라 per-instance.
  const equipVisible = useMemo(
    () => placements.filter((p) => p.kind === 'EQUIPMENT' && (floorView === 'all' || p.floor === floorView)),
    [placements, floorView],
  )
  const structureVisible = useMemo(
    () => placements.filter((p) => p.kind === 'STRUCTURE' && (floorView === 'all' || p.floor === floorView)),
    [placements, floorView],
  )
  const equipField = useMemo<FieldPlacement[]>(
    () =>
      equipVisible.map((p) => {
        const [worldX, worldZ] = placementToWorld(p.xPx, p.yPx)
        return {
          localId: p.localId,
          worldX,
          worldZ,
          floorY: floorView === 'all' ? (p.floor - 1) * FLOOR_HEIGHT : 0,
          rotationDeg: p.rotationDeg,
          status: p.equipment?.status ?? 'DOWN',
          ports: p.equipment?.portItems ?? [],
        }
      }),
    [equipVisible, floorView],
  )
  return (
    <>
      <color attach="background" args={[palette.background]} />
      <hemisphereLight intensity={palette.hemi} groundColor={palette.hemiGround} color={palette.hemiSky} />
      <ambientLight intensity={palette.ambient} />
      {/* 그림자 비사용(성능) — 메인 디렉셔널 + 전면 필 라이트로만 입체감. */}
      <directionalLight position={[14, 22, 10]} intensity={1.15} />
      {/* 전면 필 — 등각 카메라 쪽 면(설비 전면)이 어둠에 묻히지 않게. */}
      <directionalLight position={[6, 9, 18]} intensity={0.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color={palette.ground} metalness={0.1} roughness={0.95} />
      </mesh>
      <Grid args={[260, 260]} cellSize={1} cellColor={palette.gridCell} sectionSize={5} sectionColor={palette.gridSection} infiniteGrid fadeDistance={120} fadeStrength={1.3} />
      {/* 설비 — InstancedMesh 일괄(부품 종류당 1 draw call). 선택/드래그는 본체 instance onPointerDown → beginInteract. */}
      <LiveMap3DEquipmentField placements={equipField} onPartPointerDown={beginInteract} />

      {/* 구조물 — 소수라 per-instance(그룹 transform + 클릭). */}
      {structureVisible.map((placement) => {
        const [worldX, worldZ] = placementToWorld(placement.xPx, placement.yPx)
        const floorY = floorYOf(placement.floor)
        const isSelected = selectedIdSet.has(placement.localId)
        const colorOverride = placement.objectName ? LIVE_MAP_STRUCTURE_COLOR_BY_NAME[placement.objectName] : undefined
        return (
          <group key={placement.localId} position={[worldX, floorY, worldZ]} rotation={[0, (placement.rotationDeg * Math.PI) / 180, 0]}>
            {/* 뷰어(비편집) 모드에선 구조물 선택을 막는다 — 설비만 클릭해 선택/상세를 보고, 구조물(벽/파티션)은
                핸들러를 떼어 클릭이 OrbitControls 회전으로 흐르게 한다. 편집 모드에선 종전대로 선택/드래그 가능. */}
            <group onPointerDown={editing ? (event) => beginInteract(placement.localId, floorY, event) : undefined}>
              <LiveMap3DObject shape={placement.shape} colorOverride={colorOverride} />
            </group>
            {isSelected
              ? (() => {
                  const bbox = shapeBoundingBox(placement.shape)
                  return <SelectionBox center={[bbox.center.x, bbox.center.y, bbox.center.z]} size={[bbox.size.x, bbox.size.y, bbox.size.z]} />
                })()
              : null}
          </group>
        )
      })}

      {/* 설비 선택 표시 박스 — 선택된 것만(few). 회전을 적용해 설비 방향에 맞춰 감싼다. 뱃지는 Canvas 밖 오버레이. */}
      {equipVisible
        .filter((placement) => selectedIdSet.has(placement.localId))
        .map((placement) => {
          const [worldX, worldZ] = placementToWorld(placement.xPx, placement.yPx)
          return (
            <group
              key={placement.localId}
              position={[worldX, floorYOf(placement.floor), worldZ]}
              rotation={[0, (placement.rotationDeg * Math.PI) / 180, 0]}
            >
              <SelectionBox center={EQUIPMENT_SELECT_BOX.center} size={EQUIPMENT_SELECT_BOX.size} />
            </group>
          )
        })}
      <BadgeProjector equip={equipField} badgeRefs={badgeRefs} />
      {/* 편집 모드에선 카메라 회전(좌드래그)을 끈다 — 설비 좌드래그 이동과 orbit 충돌 방지. pan(우드래그)/zoom(휠)은 유지. */}
      <OrbitControls enableRotate={!editing} makeDefault />
      <CameraRig floorView={floorView} />
    </>
  )
}

/**
 * live-map 3D 등각 뷰어 씬 — SPEC live-map-3d Phase 1(읽기전용) + Phase 3(배치 편집) + Phase 4(설비 바인딩/상태/상세).
 *
 * <p>편집모드: 바닥 드래그/키보드 미세 이동 · 다중 선택(Shift+클릭) 그룹 이동/회전/삭제 · 라이브러리 추가 ·
 * 템플릿 교체 · 실설비(eqpKey) 바인딩 · 층(1~3) 배치 → PUT 영속. 뷰어: 실시간 상태 뱃지 + 선택 상세.</p>
 */
export function LiveMap3DScene({ lineKey }: LiveMap3DSceneProps) {
  const { t } = useI18n()
  const layoutQuery = useLayout(lineKey)
  const liveMapQuery = useLiveMap()
  const meQuery = useMe()
  const canEdit = hasPermission(meQuery.data?.permissionCodes, LIVE_MAP_LAYOUT_WRITE_PERMISSION)
  const objectsQuery = useLayoutObjects(canEdit)
  const saveLayout = useSaveLayout(lineKey)
  const createObject = useCreateObject()
  // gateway_app 기준 층 자동 배치용 — live-map 설비 응답엔 routePartition 이 없어, eqp 목록(routePartition)과
  // shard lease 를 따로 받아 groupEqpItems 로 gateway_app 을 산출한다(eqpKey 로 live-map 설비와 조인).
  const eqpListQuery = useEqpList()
  const gatewayShardLeasesQuery = useGatewayShardLeases()
  const selectedLineValue = useLineScopeStore((state) => state.selectedLineValue)
  const theme = useThemeStore((state) => state.theme)
  const palette = LIVE_MAP_SCENE_PALETTE[theme]

  const idRef = useRef(0)
  const nextLocalId = () => {
    idRef.current += 1
    return `wp-${idRef.current}`
  }
  // 단일 뱃지 오버레이 — 버튼 DOM 을 localId 로 등록, Canvas 안 BadgeProjector 가 좌표를 일괄 갱신.
  const badgeRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())
  // 뱃지를 설비 드래그 핸들로 — Canvas 안 SceneContent 가 "안정 노드(canvas)에 캡처 + dragRef 세팅" 함수를 여기에 등록한다.
  const beginDragRef = useRef<((localId: string, pointerId: number, planeY: number) => void) | null>(null)

  const [editing, setEditing] = useState(false)
  const [working, setWorking] = useState<WorkingPlacement[]>([])
  // 단계별 실행취소 — 각 편집 동작 직전의 working 스냅샷을 쌓는다(Ctrl+Z / 되돌리기 버튼이 pop).
  const [undoStack, setUndoStack] = useState<WorkingPlacement[][]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [addObjectKey, setAddObjectKey] = useState<string>('')
  const [addEqpKey, setAddEqpKey] = useState<string>('')
  const [floorView, setFloorView] = useState<FloorView>('all')
  const [status, setStatus] = useState<string | null>(null)

  // 레이아웃 응답이 바뀌면 working 사본을 다시 만든다 — effect 대신 render 중 prev 비교로 조정
  // (react.dev "adjusting state when a prop changes"). 서버 placement 는 placementKey 가 있어
  // 결정적 localId(wp-saved-*)를 쓰고, 편집 중 새로 추가되는 항목만 ref 카운터(wp-*)를 쓴다 —
  // prefix 가 달라 충돌하지 않고, render 중 ref 변이도 일어나지 않는다.
  const [prevLayoutData, setPrevLayoutData] = useState<typeof layoutQuery.data>(undefined)
  if (prevLayoutData !== layoutQuery.data) {
    setPrevLayoutData(layoutQuery.data)
    setSelectedIds([])
    setWorking((layoutQuery.data?.placements ?? []).map(toWorkingPlacement))
    // 서버 상태가 바뀌면(로드/저장 직후) 실행취소 히스토리를 비운다 — 저장/리로드 경계를 넘는 undo 는 막는다.
    setUndoStack([])
  }

  // 최신 working/undoStack 을 참조하는 ref — 안정적인 recordUndo/handleUndo/keydown 핸들러가 stale closure 없이 스냅샷한다.
  const workingRef = useRef<WorkingPlacement[]>(working)
  const undoStackRef = useRef<WorkingPlacement[][]>(undoStack)
  useEffect(() => {
    workingRef.current = working
  }, [working])
  useEffect(() => {
    undoStackRef.current = undoStack
  }, [undoStack])
  // 드래그 1회당 실행취소 1건 — 첫 이동 시점에 드래그 직전 상태를 1번만 push(클릭만 한 경우엔 push 안 함).
  const dragUndoPushedRef = useRef(false)

  // 편집 동작 직전 working 을 실행취소 스택에 쌓는다(현재 커밋된 상태 스냅샷).
  const recordUndo = useCallback(() => {
    setUndoStack((previous) => [...previous, workingRef.current])
  }, [])

  // 가장 최근 스냅샷으로 working 복원 + 선택 해제.
  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current
    if (stack.length === 0) {
      return
    }
    setWorking(stack[stack.length - 1])
    setUndoStack(stack.slice(0, -1))
    setSelectedIds([])
  }, [])

  // 편집 모드에서 Ctrl/Cmd+Z = 실행취소. 입력/셀렉트 포커스 시엔 무시(브라우저 기본 텍스트 undo 보존).
  useEffect(() => {
    if (!editing) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey) {
        return
      }
      if (event.key !== 'z' && event.key !== 'Z') {
        return
      }
      const tag = (document.activeElement?.tagName ?? '').toUpperCase()
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        return
      }
      event.preventDefault()
      handleUndo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing, handleUndo])

  const objectsByKey = useMemo(() => {
    const map = new Map<number, LiveMapObjectResponse>()
    for (const builtin of LIVE_MAP_BUILTIN_STRUCTURES) {
      map.set(builtin.objectKey, builtinAsObject(builtin))
    }
    for (const object of layoutQuery.data?.objects ?? []) {
      map.set(object.objectKey, object)
    }
    for (const object of objectsQuery.data ?? []) {
      map.set(object.objectKey, object)
    }
    return map
  }, [layoutQuery.data?.objects, objectsQuery.data])

  const equipmentByKey = useMemo(() => {
    const map = new Map<number, LiveMapEquipment>()
    for (const equipment of liveMapQuery.data?.equipmentItems ?? []) {
      map.set(equipment.eqpKey, equipment)
    }
    return map
  }, [liveMapQuery.data?.equipmentItems])

  // 라인 스코프 실설비 — eqp 바인딩 후보.
  const lineEquipments = useMemo(
    () => (liveMapQuery.data?.equipmentItems ?? []).filter((equipment) => equipment.lineValue === selectedLineValue),
    [liveMapQuery.data?.equipmentItems, selectedLineValue],
  )

  // working 에 이미 배치된 실설비(eqpKey) — 미배치 설비 드롭다운에서 제외(중복 방지).
  const placedEqpKeys = useMemo(
    () => new Set(working.map((placement) => placement.eqpKey).filter((key): key is number => key != null)),
    [working],
  )

  // 미배치 설비 — 라인 실설비 중 아직 배치 안 된 것. 편집모드 드롭다운에서 골라 추가한다(배치 전엔 3D 에 표시 안 됨).
  const unplacedEquipments = useMemo(
    () => lineEquipments.filter((equipment) => !placedEqpKeys.has(equipment.eqpKey)),
    [lineEquipments, placedEqpKeys],
  )

  // eqpKey → 자동 배치 대상 층. gateway_app{N} → N층(가용 층 범위로 clamp). 라인 소속 설비만 매핑한다.
  const floorByEqpKey = useMemo(() => {
    const map = new Map<number, number>()
    if (lineKey === null) {
      return map
    }
    const lineEqpInfos = (eqpListQuery.data?.items ?? []).filter((eqp) => eqp.lineKey === lineKey)
    const { gatewayGroups } = groupEqpItems(lineEqpInfos, gatewayShardLeasesQuery.data)
    const maxFloor = Math.max(...FLOOR_LEVELS)
    for (const group of gatewayGroups) {
      const floor = Math.min(group.appIndex, maxFloor)
      for (const eqp of group.items) {
        map.set(eqp.eqpKey, floor)
      }
    }
    return map
  }, [eqpListQuery.data, gatewayShardLeasesQuery.data, lineKey])

  // 자동 배치는 gateway_app 산출에 두 조회(eqp 목록 + shard lease)가 모두 필요하다. 둘 다 성공해야 활성화한다.
  const gatewayDataReady = eqpListQuery.isSuccess && gatewayShardLeasesQuery.isSuccess

  // 기본 구조 채우기 대상 층(전체 보기면 1층). 그 층에 이미 구조물이 있으면 재시드 금지 — 층마다 1회(중복 방지).
  const seedFloor = floorView === 'all' ? 1 : floorView
  const seedFloorHasStructure = useMemo(
    () =>
      working.some(
        (placement) => placement.floor === seedFloor && objectsByKey.get(placement.objectKey)?.objectKind === 'STRUCTURE',
      ),
    [working, seedFloor, objectsByKey],
  )

  // 화면에 그리는 전체 = 사용자가 배치한 placement 만(자동 표시 없음 — 미배치 설비는 보이지 않는다).
  const resolved = useMemo(() => {
    const items: ResolvedPlacement[] = []
    for (const placement of working) {
      const object = objectsByKey.get(placement.objectKey)
      const kind = object?.objectKind ?? (placement.eqpKey != null ? 'EQUIPMENT' : null)
      if (kind === 'STRUCTURE') {
        if (!object || !isLiveMap3DShape(object.shapeJson)) {
          continue
        }
        items.push({ ...placement, kind, shape: object.shapeJson, equipment: null, objectName: object.objectName })
      } else if (kind === 'EQUIPMENT') {
        const equipment = placement.eqpKey != null ? equipmentByKey.get(placement.eqpKey) ?? null : null
        items.push({ ...placement, kind, shape: EMPTY_SHAPE, equipment, objectName: object?.objectName ?? null })
      }
    }
    return items
  }, [working, objectsByKey, equipmentByKey])

  // 변경 기준선 — 마지막으로 로드/저장된 서버 상태. 저장 시 layoutQuery.data 가 교체돼 자동으로 0 으로 리셋된다.
  const baseline = useMemo<WorkingPlacement[]>(
    () => (layoutQuery.data?.placements ?? []).map(toWorkingPlacement),
    [layoutQuery.data?.placements],
  )

  // 미저장 변경 수 — 추가 + 삭제 + 수정(객체/설비/위치/회전/층)을 각각 1건으로 센다.
  const changedCount = useMemo(() => {
    const baseById = new Map(baseline.map((placement) => [placement.localId, placement]))
    const workById = new Map(working.map((placement) => [placement.localId, placement]))
    let count = 0
    for (const current of working) {
      const base = baseById.get(current.localId)
      if (!base) {
        count += 1
        continue
      }
      if (
        base.objectKey !== current.objectKey ||
        base.eqpKey !== current.eqpKey ||
        Math.round(base.xPx) !== Math.round(current.xPx) ||
        Math.round(base.yPx) !== Math.round(current.yPx) ||
        base.rotationDeg !== current.rotationDeg ||
        base.floor !== current.floor
      ) {
        count += 1
      }
    }
    for (const base of baseline) {
      if (!workById.has(base.localId)) {
        count += 1
      }
    }
    return count
  }, [working, baseline])

  // 현재 보고 있는 층(전체/단일)에 렌더되는 placement — "표시" 카운트/종류별 집계의 기준.
  const floorScopedResolved = useMemo(
    () => resolved.filter((placement) => floorView === 'all' || placement.floor === floorView),
    [resolved, floorView],
  )

  // 구조물을 종류(objectName: 벽/파티션/바닥/기둥 또는 사용자 객체명)별로 집계.
  const structureBreakdown = useMemo<readonly [string, number][]>(() => {
    const byName = new Map<string, number>()
    for (const placement of floorScopedResolved) {
      if (placement.kind === 'STRUCTURE') {
        const name = placement.objectName ?? t('livemap.viewer3d.structureUnnamed')
        byName.set(name, (byName.get(name) ?? 0) + 1)
      }
    }
    return [...byName.entries()]
  }, [floorScopedResolved, t])

  const equipmentVisibleCount = useMemo(
    () => floorScopedResolved.filter((placement) => placement.kind === 'EQUIPMENT').length,
    [floorScopedResolved],
  )


  // 추가 드롭다운/템플릿 교체 후보 = 빌트인 구조물(벽/파티션/바닥) + DB 객체. 같은 이름 DB STRUCTURE 가 있으면 빌트인은 숨김(중복 방지).
  const libraryObjects = useMemo(() => {
    const dbObjects = (objectsQuery.data ?? []).filter((object) => isLiveMap3DShape(object.shapeJson))
    const dbStructureNames = new Set(
      dbObjects.filter((object) => object.objectKind === 'STRUCTURE').map((object) => object.objectName),
    )
    const builtins = LIVE_MAP_BUILTIN_STRUCTURES.filter(
      (builtin) => !dbStructureNames.has(builtin.objectName),
    ).map(builtinAsObject)
    return [...builtins, ...dbObjects]
  }, [objectsQuery.data])

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const primaryId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null

  // 단일 뱃지 오버레이용 표시 데이터(보이는 층의 설비). 좌표는 BadgeProjector(Canvas 안)가 갱신.
  const visibleEquipForBadge = useMemo(
    () =>
      resolved.flatMap((p) =>
        p.kind === 'EQUIPMENT' && p.equipment && (floorView === 'all' || p.floor === floorView)
          ? [{ localId: p.localId, eqpKey: p.equipment.eqpKey, eqpId: p.equipment.eqpId, statusLabel: p.equipment.statusLabel, status: p.equipment.status }]
          : [],
      ),
    [resolved, floorView],
  )
  const primary = working.find((placement) => placement.localId === primaryId) ?? null
  const primaryObject = primary ? objectsByKey.get(primary.objectKey) ?? null : null
  const isEquipmentPrimary = primaryObject?.objectKind === 'EQUIPMENT'
  const primaryEquipment = primary?.eqpKey != null ? equipmentByKey.get(primary.eqpKey) ?? null : null
  // 뷰어와 동일한 상세(LiveMapTooltipCard)를 쓰기 위해 선택 설비를 보드 노드로 변환(eqpId 매칭).
  const equipmentNodes = useMemo(
    () => buildLiveMapEquipmentNodes(liveMapQuery.data?.equipmentItems ?? []),
    [liveMapQuery.data?.equipmentItems],
  )
  const selectedNode = useMemo(
    () => (primaryEquipment ? equipmentNodes.find((node) => node.eqpId === primaryEquipment.eqpId) ?? null : null),
    [equipmentNodes, primaryEquipment],
  )
  const assignCandidates = useMemo(
    () => libraryObjects.filter((object) => object.objectKind === primaryObject?.objectKind),
    [libraryObjects, primaryObject?.objectKind],
  )

  const selectPlacement = (localId: string, additive: boolean) => {
    setSelectedIds((previous) => {
      if (additive) {
        return previous.includes(localId) ? previous.filter((id) => id !== localId) : [...previous, localId]
      }
      return [localId]
    })
  }

  // 선택 placement 1개에 patch 반영.
  const patchWorking = (localId: string, patch: Partial<WorkingPlacement>) => {
    setWorking((previous) =>
      previous.map((placement) => (placement.localId === localId ? { ...placement, ...patch } : placement)),
    )
  }

  // 선택 전체에 patch 적용. makePatch 는 현재 값 기반 변환(회전/이동 누적 등)도 지원.
  const patchSelected = (makePatch: (placement: WorkingPlacement) => Partial<WorkingPlacement>) => {
    setWorking((previous) =>
      previous.map((placement) =>
        selectedIdSet.has(placement.localId) ? { ...placement, ...makePatch(placement) } : placement,
      ),
    )
  }

  // 키보드 미세 이동(②) — 선택 전체를 px 만큼 이동. 효과 의존성 안정용 useCallback.
  const nudgeSelected = useCallback(
    (dxPx: number, dyPx: number) => {
      recordUndo()
      setWorking((previous) =>
        previous.map((placement) =>
          selectedIdSet.has(placement.localId)
            ? { ...placement, xPx: placement.xPx + dxPx, yPx: placement.yPx + dyPx }
            : placement,
        ),
      )
    },
    [selectedIdSet, recordUndo],
  )

  // ② 편집모드 + 선택 있을 때 화살표로 미세 이동. 입력/셀렉트 포커스 시엔 무시(타이핑/셀렉트 조작 보존).
  useEffect(() => {
    if (!editing || selectedIds.length === 0) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toUpperCase()
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        return
      }
      const step = event.shiftKey ? NUDGE_COARSE_PX : NUDGE_PX
      let dx = 0
      let dy = 0
      switch (event.key) {
        case 'ArrowLeft':
          dx = -step
          break
        case 'ArrowRight':
          dx = step
          break
        case 'ArrowUp':
          dy = -step
          break
        case 'ArrowDown':
          dy = step
          break
        default:
          return
      }
      event.preventDefault()
      nudgeSelected(dx, dy)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing, selectedIds, nudgeSelected])

  // ③ 그룹 드래그 — 드래그 시작 시 대상(선택 전체 or 단일) 위치를 스냅샷, 이동량(delta)을 전체에 절대 적용(누적 drift 없음).
  const dragStartRef = useRef<{
    ids: string[]
    start: Map<string, { xPx: number; yPx: number }>
    anchorXPx: number
    anchorYPx: number
  } | null>(null)

  const handleDragStart = (localId: string) => {
    // 이 드래그에서 아직 실행취소 스냅샷을 안 쌓았음 — 첫 이동 시 1회 push 한다(클릭만 하면 push 없음).
    dragUndoPushedRef.current = false
    const ids = selectedIds.includes(localId) ? selectedIds : [localId]
    const start = new Map<string, { xPx: number; yPx: number }>()
    for (const id of ids) {
      const placement = working.find((item) => item.localId === id)
      if (placement) {
        start.set(id, { xPx: placement.xPx, yPx: placement.yPx })
      }
    }
    const anchor = working.find((item) => item.localId === localId)
    dragStartRef.current = anchor ? { ids, start, anchorXPx: anchor.xPx, anchorYPx: anchor.yPx } : null
  }

  const handleDragMove = (localId: string, worldX: number, worldZ: number) => {
    // 드래그 직전 상태를 1회만 실행취소 스택에 쌓는다(이후 이동은 같은 스냅샷에 누적).
    if (!dragUndoPushedRef.current) {
      recordUndo()
      dragUndoPushedRef.current = true
    }
    const [hitXPx, hitYPx] = worldToPlacement(worldX, worldZ)
    const drag = dragStartRef.current
    if (!drag) {
      patchWorking(localId, { xPx: snapToGrid(hitXPx), yPx: snapToGrid(hitYPx) })
      return
    }
    // 드래그 중인 객체(anchor)를 격자점에 스냅 → 그 변위를 선택 전체에 적용(상대 배치 유지).
    const dxPx = snapToGrid(hitXPx) - drag.anchorXPx
    const dyPx = snapToGrid(hitYPx) - drag.anchorYPx
    setWorking((previous) =>
      previous.map((placement) => {
        const snapshot = drag.start.get(placement.localId)
        return snapshot ? { ...placement, xPx: snapshot.xPx + dxPx, yPx: snapshot.yPx + dyPx } : placement
      }),
    )
  }

  const handleDragEnd = () => {
    dragStartRef.current = null
  }

  const handleAdd = () => {
    const objectKey = Number(addObjectKey)
    // 0 = 미선택 sentinel. 빌트인 구조물은 음수 키라 추가 허용(저장 시 실 객체로 치환).
    if (!Number.isInteger(objectKey) || objectKey === 0) {
      setStatus(t('livemap.viewer3d.statusPickObject'))
      return
    }
    recordUndo()
    const localId = nextLocalId()
    // 새 객체는 보고 있는 층에 추가(전체 보기면 1층). 이후 선택 패널 층 버튼으로 이동 가능.
    const addFloor = floorView === 'all' ? 1 : floorView
    setWorking((previous) => [
      ...previous,
      { localId, placementKey: null, objectKey, eqpKey: null, xPx: LIVE_MAP_BOARD_PX_WIDTH / 2, yPx: LIVE_MAP_BOARD_PX_HEIGHT / 2, rotationDeg: 0, floor: addFloor },
    ])
    setSelectedIds([localId])
    setStatus(null)
  }

  // 기본 구조 채우기 — 일반 fab 룸(바닥/외벽/기둥/파티션)을 시작점으로 보고 있는 층에 한 번에 깐다(전체 보기면 1층).
  // 빌트인 음수 키 placement 라 추가 후 각각 드래그/회전/삭제 가능하고, 저장 시 실 STRUCTURE 객체로 치환된다.
  // 그 층에 이미 구조물이 있으면 중복 시드 금지(층마다 1회).
  const handleSeedStructures = () => {
    if (seedFloorHasStructure) {
      setStatus(t('livemap.viewer3d.statusSeedTaken', { floor: seedFloor }))
      return
    }
    recordUndo()
    const seeds = buildDefaultStructureLayout().map((seed) => ({
      localId: nextLocalId(),
      placementKey: null,
      objectKey: seed.objectKey,
      eqpKey: null,
      xPx: seed.xPx,
      yPx: seed.yPx,
      rotationDeg: seed.rotationDeg,
      floor: seedFloor,
    }))
    setWorking((previous) => [...previous, ...seeds])
    setSelectedIds([])
    setStatus(t('livemap.viewer3d.statusSeeded', { count: seeds.length }))
  }

  // 미배치 설비 추가 — 선택한 실설비를 working 에 배치(백킹 EQUIPMENT 객체 키는 저장 시 치환). 초기 위치는 겹치지 않는 staging 격자.
  const handleAddEquipment = () => {
    const eqpKey = Number(addEqpKey)
    if (!Number.isInteger(eqpKey) || eqpKey <= 0) {
      setStatus(t('livemap.viewer3d.statusPickEquipment'))
      return
    }
    recordUndo()
    const localId = nextLocalId()
    const addFloor = floorView === 'all' ? 1 : floorView
    const placedCount = working.filter((placement) => placement.eqpKey != null).length
    const col = placedCount % ADD_EQP_COLS
    const row = Math.floor(placedCount / ADD_EQP_COLS)
    const startXPx = LIVE_MAP_BOARD_PX_WIDTH / 2 - ((ADD_EQP_COLS - 1) * ADD_EQP_PITCH_PX) / 2
    setWorking((previous) => [
      ...previous,
      {
        localId,
        placementKey: null,
        objectKey: AUTO_OBJECT_KEY,
        eqpKey,
        xPx: startXPx + col * ADD_EQP_PITCH_PX,
        yPx: LIVE_MAP_BOARD_PX_HEIGHT / 2 + row * ADD_EQP_PITCH_PX,
        rotationDeg: 0,
        floor: addFloor,
      },
    ])
    setSelectedIds([localId])
    setAddEqpKey('')
    setStatus(null)
  }

  // gateway_app 자동 배치 — 라인 소속 설비 "전체"를 gateway_app 기준 층(gateway_app1→1층, gateway_app2→2층)의
  // fab 라인(bay)으로 재배치한다. 기존 설비 배치는 덮어쓰고(이미 저장된 것도 다시 깔림), 구조물은 보존한다.
  // 분류 불가 설비는 1층에 모은다(누락 방지). 이후 드래그로 bay 미세조정 + 저장.
  const handleAutoPlaceEquipment = () => {
    if (lineEquipments.length === 0) {
      setStatus(t('livemap.viewer3d.statusAutoPlaceNone'))
      return
    }
    recordUndo()
    // 같은 클러스터(bay)가 한 줄에 모여 보이도록 clusterId → eqpId 순으로 정렬한 뒤 fab 라인 기하로 배치한다.
    const orderedEqpKeys = [...lineEquipments]
      .sort((a, b) => (a.clusterId === b.clusterId ? a.eqpId.localeCompare(b.eqpId) : a.clusterId.localeCompare(b.clusterId)))
      .map((equipment) => equipment.eqpKey)
    const plan = planEquipmentLineLayout(orderedEqpKeys, floorByEqpKey, 1, LIVE_MAP_FAB_LINE_LAYOUT)
    const newEquipmentPlacements = plan.map((item) => ({
      localId: nextLocalId(),
      placementKey: null,
      objectKey: AUTO_OBJECT_KEY,
      eqpKey: item.eqpKey,
      xPx: item.xPx,
      yPx: item.yPx,
      rotationDeg: item.rotationDeg,
      floor: item.floor,
    }))
    // 기존 설비 placement(eqpKey 보유)는 모두 걷어내고 라인 레이아웃으로 교체. 구조물(eqpKey 없음)은 그대로 둔다.
    setWorking((previous) => [...previous.filter((placement) => placement.eqpKey == null), ...newEquipmentPlacements])
    setSelectedIds([])
    setStatus(t('livemap.viewer3d.statusAutoPlaced', { count: newEquipmentPlacements.length }))
  }

  const rotateSelected = (deltaDeg: number) => {
    recordUndo()
    patchSelected((placement) => ({ rotationDeg: placement.rotationDeg + deltaDeg }))
  }
  const setFloorForSelected = (floor: number) => {
    recordUndo()
    patchSelected(() => ({ floor }))
  }
  const assignTemplateToPrimary = (objectKey: number) => {
    if (primaryId) {
      recordUndo()
      patchWorking(primaryId, { objectKey })
    }
  }
  const bindEqpToPrimary = (eqpKey: number | null) => {
    if (primaryId) {
      recordUndo()
      patchWorking(primaryId, { eqpKey })
    }
  }

  const deleteSelected = () => {
    if (selectedIds.length === 0) {
      return
    }
    recordUndo()
    setWorking((previous) => previous.filter((placement) => !selectedIdSet.has(placement.localId)))
    setSelectedIds([])
  }

  // object_key 가 NOT NULL FK 라, 자동 표시(objectKey 0) 설비를 저장하려면 백킹 EQUIPMENT 객체가 1개 필요.
  // 라이브러리에 EQUIPMENT 객체가 있으면 재사용, 없으면 1회 생성.
  const ensureEquipmentObjectKey = async (): Promise<number> => {
    const existing = (objectsQuery.data ?? []).find((object) => object.objectKind === 'EQUIPMENT')
    if (existing) {
      return existing.objectKey
    }
    const created = await createObject.mutateAsync({
      objectName: BUILTIN_EQUIPMENT_NAME,
      objectKind: 'EQUIPMENT',
      shapeJson: BUILTIN_EQUIPMENT_SHAPE as unknown as ShapeJson,
    })
    return created.objectKey
  }

  // 빌트인 구조물(음수 키)을 저장하려면 같은 이름의 실 STRUCTURE 객체가 필요 — 있으면 재사용, 없으면 1회 생성.
  const ensureBuiltinStructureObjectKey = async (builtinKey: number): Promise<number> => {
    const builtin = LIVE_MAP_BUILTIN_STRUCTURES.find((item) => item.objectKey === builtinKey)
    if (!builtin) {
      throw new Error(`unknown builtin structure ${builtinKey}`)
    }
    const existing = (objectsQuery.data ?? []).find(
      (object) => object.objectKind === 'STRUCTURE' && object.objectName === builtin.objectName,
    )
    if (existing) {
      return existing.objectKey
    }
    const created = await createObject.mutateAsync({
      objectName: builtin.objectName,
      objectKind: 'STRUCTURE',
      shapeJson: builtin.shapeJson as unknown as ShapeJson,
    })
    return created.objectKey
  }

  const handleSave = async () => {
    try {
      // 빌트인 키(설비 자동표시 0 / 구조물 음수)를 실 객체 키로 1회씩 치환.
      const keyRemap = new Map<number, number>()
      if (working.some((placement) => placement.objectKey === AUTO_OBJECT_KEY)) {
        keyRemap.set(AUTO_OBJECT_KEY, await ensureEquipmentObjectKey())
      }
      const builtinStructureKeys = [
        ...new Set(working.map((placement) => placement.objectKey).filter(isBuiltinStructureKey)),
      ]
      for (const builtinKey of builtinStructureKeys) {
        keyRemap.set(builtinKey, await ensureBuiltinStructureObjectKey(builtinKey))
      }
      await saveLayout.mutateAsync({
        canvasJson: layoutQuery.data?.canvasJson ?? DEFAULT_CANVAS_JSON,
        placements: working.map((placement) => ({
          objectKey: keyRemap.get(placement.objectKey) ?? placement.objectKey,
          eqpKey: placement.eqpKey,
          transformJson: buildTransformJson({
            x: placement.xPx,
            y: placement.yPx,
            rotation: placement.rotationDeg,
            floor: placement.floor,
          }),
        })),
      })
      setStatus(t('livemap.viewer3d.statusSaved'))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t('livemap.viewer3d.statusSaveFailed'))
    }
  }

  return (
    <section data-testid="live-map-3d-scene" className="relative h-[calc(100dvh-16rem)] min-h-110 overflow-hidden rounded-3xl border border-border bg-card shadow-soft-lg">
      {/* frameloop=demand — 연속 rAF 루프 대신 상호작용/상태변화 시에만 렌더(병렬 e2e teardown 안정 + 부하↓).
          그림자 비사용 + dpr 캡(레티나 과샘플 방지)으로 3D 진입/조작 렌더 부하를 낮춘다. */}
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ powerPreference: 'high-performance' }}
        orthographic
        camera={{ position: [16, 16, 16], zoom: 14, near: -200, far: 200 }}
      >
        <SceneContent
          placements={resolved}
          selectedIdSet={selectedIdSet}
          editing={editing}
          palette={palette}
          floorView={floorView}
          badgeRefs={badgeRefs}
          onSelect={selectPlacement}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          beginDragRef={beginDragRef}
        />
      </Canvas>

      {/* 상태 뱃지 — 단일 DOM 오버레이(plain 버튼 N개). 위치는 BadgeProjector 가 매 프레임 transform 으로 갱신.
          drei Html 포털 N개 제거 → 진입 비용↓. 항상표시 라벨·뱃지클릭 선택 유지. */}
      {/* 편집 모드에선 뱃지를 컨트롤 패널(z-10) 위로 올린다 — 설비를 패널 영역(상단 추가 패널 등)으로 옮겼을 때
          뱃지가 패널에 덮여 다시 못 잡는 버그를 막는다. 뷰어 모드에선 chrome 이 위(z-6). */}
      <div className={`pointer-events-none absolute inset-0 ${editing ? 'z-20' : 'z-6'}`}>
        {visibleEquipForBadge.map((badge) => {
          const isSelected = selectedIdSet.has(badge.localId)
          const color = LIVE_MAP_STATUS_COLOR[badge.status]
          return (
            <Button
              key={badge.localId}
              variant="outline"
              size="sm"
              ref={(element) => {
                const map = badgeRefs.current
                if (element) {
                  map.set(badge.localId, element)
                } else {
                  map.delete(badge.localId)
                }
              }}
              type="button"
              data-testid={`live-map-3d-badge-${badge.eqpKey}`}
              // 뱃지 = 설비 선택 + 드래그 핸들(작은 줌에서 3D 메시 직접 잡기 어려움 → 큰 HTML 타깃으로 이동).
              // 선택은 pointerdown 한 곳에서만(shift 토글이 click 과 중복돼 상쇄되지 않게). 드래그는 안정 노드(canvas)에
              // 캡처를 걸어 Canvas 의 pointermove/up/cancel 리스너가 처리한다 — 뱃지 버튼 자체 캡처는 재렌더 시 풀린다.
              onPointerDown={(event) => {
                const additive = event.shiftKey || event.ctrlKey || event.metaKey
                selectPlacement(badge.localId, additive)
                if (!canEdit || !editing || additive) {
                  return
                }
                const placement = working.find((item) => item.localId === badge.localId)
                if (!placement) {
                  return
                }
                event.preventDefault()
                handleDragStart(badge.localId)
                beginDragRef.current?.(badge.localId, event.pointerId, floorView === 'all' ? (placement.floor - 1) * FLOOR_HEIGHT : 0)
              }}
              className={`pointer-events-auto absolute left-0 top-0 flex h-auto cursor-grab transition-none items-center gap-1 whitespace-nowrap rounded-full border font-bold shadow-soft-md active:cursor-grabbing ${
                isSelected ? 'z-1 border-2 px-3 py-1 text-[12px]' : 'px-2 py-0.5 text-[10px]'
              }`}
              style={{
                transform: 'translate(-9999px, -9999px)',
                borderColor: color,
                color: isSelected ? SELECTED_BADGE_FG : color,
                background: isSelected ? color : palette.badgeBg,
              }}
            >
              <span className="size-1.5 rounded-full" style={{ background: isSelected ? SELECTED_BADGE_FG : color }} />
              {badge.eqpId} · {badge.statusLabel}
            </Button>
          )
        })}
      </div>

      {/* 상단 우측 — 편집 토글 + 저장.
          좌측 편집 패널과 같은 `top-4` 줄에 있고 그쪽은 `flex-wrap` 으로 폭에 따라 늘어난다.
          전역 LNB 가 본문 폭을 256px 가져가면서 좌측 패널이 이 클러스터 아래까지 뻗어
          Undo/Save 클릭을 가로챘다 — 이쪽을 위 레이어로 올려 히트 테스트를 이긴다. */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {/* 현재 층(전체/1/2층) 기준 — 표시 합계 + 구조물 종류별 + 설비 대수. 편집 가능자에겐 미저장 변경 수도. */}
        <span
          data-testid="live-map-3d-count-chip"
          title={t('livemap.viewer3d.countHint')}
          className="flex max-w-[60vw] flex-wrap items-center gap-x-2 gap-y-0.5 rounded-pill border border-border bg-card/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur"
        >
          <span>
            {t('livemap.viewer3d.countVisible')}{' '}
            <span data-testid="live-map-3d-visible-count">{floorScopedResolved.length}</span>
          </span>
          {structureBreakdown.map(([name, count]) => (
            <span key={name}>
              · {name} {count}
            </span>
          ))}
          <span>
            · {t('livemap.viewer3d.countEquip')} {equipmentVisibleCount}
          </span>
          {editing ? (
            <span className="text-foreground">
              · {t('livemap.viewer3d.countChanged')}{' '}
              <span data-testid="live-map-3d-changed-count">{changedCount}</span>
            </span>
          ) : null}
          {/* 총 배치 수 — 화면엔 노출하지 않고(요청대로 변경 수만 표시), 재배치/추가 invariant e2e 의 검증 핸들로만 둔다. */}
          <span className="sr-only" data-testid="live-map-3d-placement-count">
            {working.length}
          </span>
        </span>
        {canEdit ? (
          <>
            <Button
              type="button"
              variant="default"
              size="sm"
              data-testid="live-map-3d-edit-toggle"
              aria-pressed={editing}
              onClick={() => {
                setEditing((value) => !value)
                setSelectedIds([])
              }}
              title={editing ? t('livemap.viewer3d.editToggleExit') : t('livemap.viewer3d.editToggleStart')}
              className={`rounded-pill px-4 py-1.5 text-[12px] font-bold transition-colors ${
                editing ? 'bg-brand-primary text-white hover:bg-brand-primary/90' : 'border border-border bg-card/90 text-foreground backdrop-blur hover:bg-muted'
              }`}
            >
              {editing ? t('livemap.viewer3d.editExit') : t('livemap.viewer3d.edit')}
            </Button>
            {editing ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                data-testid="live-map-3d-undo"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title={t('livemap.viewer3d.undoTitle')}
                className="rounded-pill border border-border bg-card/90 px-4 py-1.5 text-[12px] font-bold text-foreground backdrop-blur transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('livemap.viewer3d.undo')}
              </Button>
            ) : null}
            {editing ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                data-testid="live-map-3d-save"
                onClick={handleSave}
                disabled={saveLayout.isPending || createObject.isPending}
                title={t('livemap.viewer3d.saveTitle')}
                className="rounded-pill bg-primary px-4 py-1.5 text-[12px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('livemap.viewer3d.save')}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {/* 층 뷰(④) — 항상 노출. 특정 층은 그 층만(바닥 평탄화) 보기, 전체는 적층. 편집 중 새 추가는 보고 있는 층에 들어간다. */}
      <div data-testid="live-map-3d-floors" className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-[14px] border border-border bg-card/90 p-1 shadow-soft-md backdrop-blur">
        {/* 위에서부터 3F·2F·1F (건물 은유) + 맨 아래 전체. */}
        {[...FLOOR_LEVELS].reverse().map((floor) => (
          <Button
            key={floor}
            type="button"
            variant="ghost"
            size="sm"
            data-testid={`live-map-3d-floor-${floor}`}
            aria-pressed={floorView === floor}
            onClick={() => setFloorView(floor)}
            title={t('livemap.viewer3d.floorOnly', { floor })}
            className={`size-9 rounded-md text-xs font-bold transition-colors ${
              floorView === floor ? 'bg-brand-primary text-white' : 'text-foreground hover:bg-muted'
            }`}
          >
            {floor}F
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="live-map-3d-floor-all"
          aria-pressed={floorView === 'all'}
          onClick={() => setFloorView('all')}
          title={t('livemap.viewer3d.allFloors')}
          className={`flex h-9 items-center justify-center rounded-md px-1 text-[11px] font-bold transition-colors ${
            floorView === 'all' ? 'bg-brand-primary text-white' : 'text-foreground hover:bg-muted'
          }`}
        >
          {t('livemap.viewer3d.all')}
        </Button>
      </div>

      {/* 편집 — 추가 패널: 구조물(라이브러리 + 기본 구조) | 미배치 설비 */}
      {editing ? (
        /* `top-4` 가 아니라 `top-16` — 우측 컨트롤 클러스터와 같은 줄에 두면 이 패널이
           `flex-wrap` 으로 늘어나며 그 아래로 파고들어 Undo/Save 를 덮는다(전역 LNB 가 본문 폭을
           256px 가져간 뒤 실제로 덮혔다). 우측 상세 패널(`right-4 top-16`)과 같은 줄로 내린다. */
        <div className="absolute left-4 top-16 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 rounded-[14px] border border-border bg-card/90 px-3 py-2 shadow-soft-md backdrop-blur">
          <Select
            value={addObjectKey === '' ? SELECT_EMPTY_VALUE : addObjectKey}
            onValueChange={(next) => setAddObjectKey(next === SELECT_EMPTY_VALUE ? '' : next)}
          >
            <SelectTrigger
              data-testid="live-map-3d-add-select"
              className="h-auto w-auto cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/50"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_EMPTY_VALUE}>{t('livemap.viewer3d.optObject')}</SelectItem>
              {libraryObjects.map((object) => (
                <SelectItem key={object.objectKey} value={String(object.objectKey)}>
                  {object.objectName} ({object.objectKind})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" data-testid="live-map-3d-add" onClick={handleAdd} title={t('livemap.viewer3d.addToFloor', { floor: floorView === 'all' ? 1 : floorView })} className="rounded-md border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
            {t('livemap.viewer3d.add')}
          </Button>
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="live-map-3d-seed-structures"
            onClick={handleSeedStructures}
            disabled={seedFloorHasStructure}
            title={seedFloorHasStructure ? t('livemap.viewer3d.seedStructuresDoneTitle', { floor: seedFloor }) : t('livemap.viewer3d.seedStructuresTitle')}
            className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('livemap.viewer3d.seedStructures')}
          </Button>
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          {/* 미배치 설비 — 골라서 추가해야만 3D 에 표시된다(자동 표시 없음). */}
          <Select
            value={addEqpKey === '' ? SELECT_EMPTY_VALUE : addEqpKey}
            onValueChange={(next) => setAddEqpKey(next === SELECT_EMPTY_VALUE ? '' : next)}
            disabled={unplacedEquipments.length === 0}
          >
            <SelectTrigger
              data-testid="live-map-3d-add-eqp-select"
              className="h-auto w-auto cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_EMPTY_VALUE}>
                {unplacedEquipments.length === 0 ? t('livemap.viewer3d.optAllPlaced') : t('livemap.viewer3d.optUnplacedEqp')}
              </SelectItem>
              {unplacedEquipments.map((equipment) => (
                <SelectItem key={equipment.eqpKey} value={String(equipment.eqpKey)}>
                  {equipment.eqpName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" data-testid="live-map-3d-add-eqp" onClick={handleAddEquipment} title={t('livemap.viewer3d.addEquipmentTitle')} className="rounded-md border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
            {t('livemap.viewer3d.addEquipment')}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            data-testid="live-map-3d-auto-place"
            onClick={handleAutoPlaceEquipment}
            disabled={lineEquipments.length === 0 || !gatewayDataReady}
            title={t('livemap.viewer3d.autoPlaceTitle')}
            className="rounded-md border border-primary bg-primary/5 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('livemap.viewer3d.autoPlace')}
          </Button>
        </div>
      ) : null}

      {/* 편집 — 선택 객체 패널 */}
      {editing && primary ? (
        <div data-testid="live-map-3d-selected" className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-card/95 px-3 py-2 shadow-soft-lg backdrop-blur">
          <span className="text-xs font-bold text-foreground">
            {primaryObject?.objectName ?? primaryEquipment?.eqpName ?? 'object'}
            {selectedIds.length > 1 ? (
              <span data-testid="live-map-3d-selected-count" className="ml-1 font-semibold text-muted-foreground">
                {t('livemap.viewer3d.selectedMore', { count: selectedIds.length - 1 })}
              </span>
            ) : null}
          </span>
          <Button type="button" variant="outline" size="sm" data-testid="live-map-3d-rotate-ccw" onClick={() => rotateSelected(-ROTATE_STEP)} title={t('livemap.viewer3d.rotateCcw')} aria-label={t('livemap.viewer3d.rotateCcw')} className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-muted">
            ⟲
          </Button>
          <Button type="button" variant="outline" size="sm" data-testid="live-map-3d-rotate-cw" onClick={() => rotateSelected(ROTATE_STEP)} title={t('livemap.viewer3d.rotateCw')} aria-label={t('livemap.viewer3d.rotateCw')} className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-muted">
            ⟳
          </Button>
          {/* 선택을 다른 층으로 이동 */}
          <div className="flex items-center gap-0.5" role="group" aria-label={t('livemap.viewer3d.floorMove')}>
            {FLOOR_LEVELS.map((floor) => (
              <Button
                key={floor}
                type="button"
                variant="outline"
                size="sm"
                data-testid={`live-map-3d-set-floor-${floor}`}
                onClick={() => setFloorForSelected(floor)}
                title={t('livemap.viewer3d.moveToFloor', { floor })}
                className={`size-7 rounded-md border text-xs font-semibold transition-colors ${
                  primary.floor === floor ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {floor}
              </Button>
            ))}
          </div>
          {assignCandidates.length > 0 ? (
            <Select
              value={String(primary.objectKey)}
              onValueChange={(next) => assignTemplateToPrimary(Number(next))}
            >
              <SelectTrigger
                data-testid="live-map-3d-assign-select"
                title={t('livemap.viewer3d.replaceTemplate')}
                className="h-auto w-auto cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/50"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignCandidates.map((object) => (
                  <SelectItem key={object.objectKey} value={String(object.objectKey)}>
                    {object.objectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {isEquipmentPrimary ? (
            <Select
              value={primary.eqpKey === null ? SELECT_EMPTY_VALUE : String(primary.eqpKey)}
              onValueChange={(next) => bindEqpToPrimary(next === SELECT_EMPTY_VALUE ? null : Number(next))}
            >
              <SelectTrigger
                data-testid="live-map-3d-eqp-select"
                title={t('livemap.viewer3d.bindEqp')}
                className="h-auto w-auto cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/50"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_EMPTY_VALUE}>{t('livemap.viewer3d.optEquipment')}</SelectItem>
                {lineEquipments.map((equipment) => (
                  <SelectItem key={equipment.eqpKey} value={String(equipment.eqpKey)}>
                    {equipment.eqpName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button type="button" variant="outline" size="sm" data-testid="live-map-3d-delete" onClick={deleteSelected} title={t('livemap.viewer3d.deleteTitle')} className="rounded-full border border-danger px-3 py-1 text-xs font-semibold text-danger transition-colors hover:bg-danger/10">
            {t('livemap.viewer3d.delete')}
          </Button>
        </div>
      ) : null}

      {/* 선택 설비 상세(R5) — 뷰어와 동일한 LiveMapTooltipCard(속성/포트/통신로그). top-16~bottom-4 로 통신로그 flex 높이 확보.
          편집 모드에선 숨긴다 — 우측 큰 패널(z-10)이 설비 뱃지(z-6)를 덮어, 우측으로 옮긴 설비를 다시 못 잡는 버그를 유발.
          편집 중 선택 객체 제어는 하단 편집 패널이 담당하고, 상세 모니터링(상태/포트/로그)은 뷰어 모드 전용으로 둔다. */}
      {!editing && selectedNode ? (
        <div data-testid="live-map-3d-detail" className="absolute right-4 top-16 bottom-4 z-10 w-82.5">
          <LiveMapTooltipCard equipment={selectedNode} onClose={() => setSelectedIds([])} />
        </div>
      ) : null}

      {/* 조작 힌트 — OrbitControls 기본 매핑(좌:회전 / 우:이동 / 휠:확대)이라 화면 이동(pan)이 우드래그/두손가락임을 안내. */}
      <div
        data-testid="live-map-3d-controls-hint"
        className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-pill border border-border bg-card/80 px-3 py-1 text-[10px] font-semibold text-muted-foreground backdrop-blur"
      >
        {editing
          ? t('livemap.viewer3d.hintEdit')
          : t('livemap.viewer3d.hintView')}
      </div>

      {status ? (
        <div data-testid="live-map-3d-status" className="absolute bottom-4 right-4 z-10 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur">
          {status}
        </div>
      ) : null}
    </section>
  )
}
