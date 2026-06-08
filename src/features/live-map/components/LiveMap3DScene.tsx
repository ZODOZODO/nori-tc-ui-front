import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useMe } from '@/features/profile/hooks/useProfile'
import { hasPermission, LIVE_MAP_LAYOUT_WRITE_PERMISSION } from '@/shared/lib/permission'
import { useLineScopeStore } from '@/shared/stores/line-scope.store'
import { useThemeStore } from '@/shared/stores/theme.store'
import type { LiveMapObjectResponse } from '../api/layout.api'
import type { LiveMapEquipmentResponse as LiveMapEquipment } from '../api/live-map.api'
import { useCreateObject, useLayout, useLayoutObjects, useSaveLayout } from '../hooks/useLayout'
import { useLiveMap } from '../hooks/useLiveMap'
import { buildLiveMapEquipmentNodes } from '../lib/live-map-data'
import { LIVE_MAP_CLUSTER_ITEMS } from '../mocks/live-map.mock'
import { buildTransformJson, DEFAULT_CANVAS_JSON, type ShapeJson } from '../lib/live-map-layout.model'
import {
  buildAutoEquipmentPlacements,
  floorForCluster,
  isBuiltinStructureKey,
  isLiveMap3DShape,
  LIVE_MAP_BUILTIN_STRUCTURES,
  LIVE_MAP_STATUS_COLOR,
  placementToWorld,
  worldToPlacement,
  type LiveMap3DShape,
  type LiveMapBuiltinStructure,
} from '../lib/live-map-3d.model'
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
}

const ROTATE_STEP = 15
/** 키보드 화살표 미세 이동 단위(px). Shift 동반 시 거친 단위. */
const NUDGE_PX = 8
const NUDGE_COARSE_PX = 40
/** 층 — 1~3층, 층간 높이(world unit). 설비(~4 높이) 위로 충분한 여유(뱃지/시그널타워 안 겹치게). */
const FLOOR_LEVELS = [1, 2, 3] as const
const FLOOR_HEIGHT = 6
/** 전체 보기에서 카메라 타깃을 층 스택 중앙으로 — 3층까지 화면에 들어오게. */
const STACK_CENTER_Y = (FLOOR_HEIGHT * (FLOOR_LEVELS.length - 1)) / 2
/** 층 뷰 — 특정 층만 보기 or 전체 적층. */
type FloorView = number | 'all'

/** 3D 캔버스(WebGL)는 CSS 토큰을 못 쓰므로 테마별 색을 직접 분기한다. 오버레이/상세는 CSS 토큰으로 자동 대응. */
interface ScenePalette {
  background: string
  ground: string
  gridCell: string
  gridSection: string
  hemiSky: string
  hemiGround: string
  ambient: number
  hemi: number
  contactOpacity: number
  badgeBg: string
}
const SCENE_PALETTE: Record<'light' | 'dark', ScenePalette> = {
  dark: { background: '#0e1422', ground: '#0b1020', gridCell: '#1e2638', gridSection: '#3a4a63', hemiSky: '#cbd5e1', hemiGround: '#0b0f1a', ambient: 0.45, hemi: 0.45, contactOpacity: 0.45, badgeBg: 'rgba(11,16,32,0.92)' },
  light: { background: '#eef2f7', ground: '#dce3ed', gridCell: '#cdd6e2', gridSection: '#9aabbf', hemiSky: '#ffffff', hemiGround: '#c2ccd8', ambient: 0.72, hemi: 0.6, contactOpacity: 0.3, badgeBg: 'rgba(255,255,255,0.95)' },
}

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
    orthographic.zoom = floorView === 'all' ? 32 : 48
    orthographic.updateProjectionMatrix()
    if (controls) {
      controls.target.set(0, floorView === 'all' ? STACK_CENTER_Y : 0, 0)
      controls.update()
    }
    invalidate()
  }, [floorView, camera, controls, invalidate])
  return null
}

/** 선택 강조 — 굵은 시안 링 + 외곽 글로우 링(멀리서도 footprint 가 즉시 보이게). 설비/구조물 공용. */
function SelectionRings() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[2.0, 2.6, 48]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[2.6, 3.15, 48]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.22} />
      </mesh>
    </group>
  )
}

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
      vec.set(p.worldX, p.floorY + 3.1, p.worldZ)
      vec.project(camera)
      const x = (vec.x * 0.5 + 0.5) * width
      const y = (-vec.y * 0.5 + 0.5) * height
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
}: {
  placements: ResolvedPlacement[]
  selectedIdSet: ReadonlySet<string>
  editing: boolean
  palette: ScenePalette
  floorView: FloorView
  badgeRefs: RefObject<Map<string, HTMLButtonElement | null>>
  onSelect: (localId: string, additive: boolean) => void
  onDragStart: (localId: string) => void
  onDragMove: (localId: string, worldX: number, worldZ: number) => void
  onDragEnd: () => void
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
        element.releasePointerCapture?.(event.pointerId)
        dragRef.current = null
        onDragEnd()
      }
    }
    element.addEventListener('pointermove', handleMove)
    element.addEventListener('pointerup', handleUp)
    element.addEventListener('pointercancel', handleUp)
    return () => {
      element.removeEventListener('pointermove', handleMove)
      element.removeEventListener('pointerup', handleUp)
      element.removeEventListener('pointercancel', handleUp)
    }
  }, [gl, camera, raycaster, onDragMove, onDragEnd])

  const beginInteract = useCallback(
    (localId: string, floorY: number, event: ThreeEvent<PointerEvent>) => {
      const additive = event.shiftKey || event.ctrlKey || event.metaKey
      onSelect(localId, additive)
      // Shift/Ctrl = 다중 선택 토글이므로 드래그 시작 안 함. 비-additive 클릭만 드래그.
      if (!editing || additive) {
        return
      }
      event.stopPropagation()
      gl.domElement.setPointerCapture?.(event.pointerId)
      dragPlaneRef.current.constant = -floorY
      dragRef.current = { localId, pointerId: event.pointerId }
      onDragStart(localId)
    },
    [onSelect, editing, gl, onDragStart],
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
      <directionalLight position={[14, 22, 10]} intensity={1.15} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} />
      {/* 전면 필 — 등각 카메라 쪽 면(설비 전면)이 어둠에 묻히지 않게. 그림자 없음. */}
      <directionalLight position={[6, 9, 18]} intensity={0.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color={palette.ground} metalness={0.1} roughness={0.95} />
      </mesh>
      <Grid args={[160, 160]} cellSize={1} cellColor={palette.gridCell} sectionSize={5} sectionColor={palette.gridSection} infiniteGrid fadeDistance={56} fadeStrength={1.3} />
      <ContactShadows position={[0, 0.01, 0]} opacity={palette.contactOpacity} scale={80} blur={2.2} far={22} resolution={512} />
      {/* 상층 슬래브 — 전체 보기에서만 2층 이상 층 높이에 반투명 바닥을 깔아 층 구분이 보이게(단일 보기는 바닥 평탄화). */}
      {floorView === 'all'
        ? FLOOR_LEVELS.filter((floor) => floor > 1).map((floor) => (
            <mesh key={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, (floor - 1) * FLOOR_HEIGHT - 0.02, 0]} receiveShadow>
              <planeGeometry args={[70, 70]} />
              <meshStandardMaterial color={palette.ground} transparent opacity={0.5} metalness={0.1} roughness={0.95} />
            </mesh>
          ))
        : null}
      {/* 설비 — InstancedMesh 일괄(부품 종류당 1 draw call). 선택/드래그는 본체 instance onPointerDown → beginInteract. */}
      <LiveMap3DEquipmentField placements={equipField} onPartPointerDown={beginInteract} />

      {/* 구조물 — 소수라 per-instance(그룹 transform + 클릭). */}
      {structureVisible.map((placement) => {
        const [worldX, worldZ] = placementToWorld(placement.xPx, placement.yPx)
        const floorY = floorYOf(placement.floor)
        const isSelected = selectedIdSet.has(placement.localId)
        return (
          <group key={placement.localId} position={[worldX, floorY, worldZ]} rotation={[0, (placement.rotationDeg * Math.PI) / 180, 0]}>
            <group onPointerDown={(event) => beginInteract(placement.localId, floorY, event)}>
              <LiveMap3DObject shape={placement.shape} />
            </group>
            {isSelected ? <SelectionRings /> : null}
          </group>
        )
      })}

      {/* 설비 선택링 — 선택된 것만(few). 뱃지는 Canvas 밖 단일 오버레이(BadgeProjector 가 좌표 갱신). */}
      {equipVisible
        .filter((placement) => selectedIdSet.has(placement.localId))
        .map((placement) => {
          const [worldX, worldZ] = placementToWorld(placement.xPx, placement.yPx)
          return (
            <group key={placement.localId} position={[worldX, floorYOf(placement.floor), worldZ]}>
              <SelectionRings />
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
  const layoutQuery = useLayout(lineKey)
  const liveMapQuery = useLiveMap()
  const meQuery = useMe()
  const canEdit = hasPermission(meQuery.data?.permissionCodes, LIVE_MAP_LAYOUT_WRITE_PERMISSION)
  const objectsQuery = useLayoutObjects(canEdit)
  const saveLayout = useSaveLayout(lineKey)
  const createObject = useCreateObject()
  const selectedLineValue = useLineScopeStore((state) => state.selectedLineValue)
  const theme = useThemeStore((state) => state.theme)
  const palette = SCENE_PALETTE[theme]

  const idRef = useRef(0)
  const nextLocalId = () => {
    idRef.current += 1
    return `wp-${idRef.current}`
  }
  // 단일 뱃지 오버레이 — 버튼 DOM 을 localId 로 등록, Canvas 안 BadgeProjector 가 좌표를 일괄 갱신.
  const badgeRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())

  const [editing, setEditing] = useState(false)
  const [working, setWorking] = useState<WorkingPlacement[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [addObjectKey, setAddObjectKey] = useState<string>('')
  const [floorView, setFloorView] = useState<FloorView>('all')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const placements = layoutQuery.data?.placements ?? []
    setSelectedIds([])
    setWorking(
      placements.map((placement) => ({
        localId: nextLocalId(),
        placementKey: placement.placementKey,
        objectKey: placement.objectKey,
        eqpKey: placement.eqpKey,
        xPx: placement.transformJson.x,
        yPx: placement.transformJson.y,
        rotationDeg: placement.transformJson.rotation,
        floor: placement.transformJson.floor ?? 1,
      })),
    )
  }, [layoutQuery.data])

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

  // 저장 placement 에 이미 잡힌 실설비(eqpKey) — 자동 표시에서 제외(중복 방지).
  const placedEqpKeys = useMemo(
    () => new Set(working.map((placement) => placement.eqpKey).filter((key): key is number => key != null)),
    [working],
  )

  // 저장 placement 가 없는 라인 실설비를 캐비닛 그리드로 자동 표시(objectKey 0 = 빌트인, 저장 시 백킹 객체로 치환).
  // 위치는 전체 라인 설비의 고정 index 기반(buildAutoEquipmentPlacements) — 일부 승격(편집)해도 나머지 위치 불변.
  // 층은 공정(clusterId)별 자동 배치(floorForCluster) — 1F: photo/etch/cvd, 2F: cmp/diff/imp, 3F: wet/metal, 그 외 1층.
  const autoPlacements = useMemo<WorkingPlacement[]>(() => {
    const eqpKeys = lineEquipments.map((equipment) => equipment.eqpKey)
    return buildAutoEquipmentPlacements(eqpKeys, placedEqpKeys).map(({ eqpKey, xPx, yPx }) => ({
      localId: `auto-${eqpKey}`,
      placementKey: null,
      objectKey: AUTO_OBJECT_KEY,
      eqpKey,
      xPx,
      yPx,
      rotationDeg: 0,
      floor: floorForCluster(equipmentByKey.get(eqpKey)?.clusterId),
    }))
  }, [lineEquipments, placedEqpKeys, equipmentByKey])

  const autoById = useMemo(() => new Map(autoPlacements.map((placement) => [placement.localId, placement])), [autoPlacements])

  // 화면에 그리는 전체 = 저장/편집된 placement + 자동 표시 설비.
  const allPlacements = useMemo(() => [...working, ...autoPlacements], [working, autoPlacements])

  const resolved = useMemo(() => {
    const items: ResolvedPlacement[] = []
    for (const placement of allPlacements) {
      const object = objectsByKey.get(placement.objectKey)
      const kind = object?.objectKind ?? (placement.eqpKey != null ? 'EQUIPMENT' : null)
      if (kind === 'STRUCTURE') {
        if (!object || !isLiveMap3DShape(object.shapeJson)) {
          continue
        }
        items.push({ ...placement, kind, shape: object.shapeJson, equipment: null })
      } else if (kind === 'EQUIPMENT') {
        const equipment = placement.eqpKey != null ? equipmentByKey.get(placement.eqpKey) ?? null : null
        items.push({ ...placement, kind, shape: EMPTY_SHAPE, equipment })
      }
    }
    return items
  }, [allPlacements, objectsByKey, equipmentByKey])


  // 추가 드롭다운/템플릿 교체 후보 = 빌트인 구조물(벽/파티션) + DB 객체. 같은 이름 DB STRUCTURE 가 있으면 빌트인은 숨김(중복 방지).
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
  const primary = allPlacements.find((placement) => placement.localId === primaryId) ?? null
  const primaryObject = primary ? objectsByKey.get(primary.objectKey) ?? null : null
  const isEquipmentPrimary = primaryObject?.objectKind === 'EQUIPMENT'
  const primaryEquipment = primary?.eqpKey != null ? equipmentByKey.get(primary.eqpKey) ?? null : null
  // 뷰어와 동일한 상세(LiveMapTooltipCard)를 쓰기 위해 선택 설비를 보드 노드로 변환(eqpId 매칭).
  const equipmentNodes = useMemo(
    () => buildLiveMapEquipmentNodes(liveMapQuery.data?.equipmentItems ?? [], LIVE_MAP_CLUSTER_ITEMS),
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

  // 편집 시 working 에 반영 — 자동 표시 설비(auto-*)는 working 에 없으므로 이때 승격(promote)한다.
  const patchWorking = (localId: string, patch: Partial<WorkingPlacement>) => {
    setWorking((previous) => {
      if (previous.some((placement) => placement.localId === localId)) {
        return previous.map((placement) => (placement.localId === localId ? { ...placement, ...patch } : placement))
      }
      const auto = autoById.get(localId)
      if (!auto) {
        return previous
      }
      return [...previous, { ...auto, ...patch }]
    })
  }

  // 선택 전체에 patch 적용(자동 설비는 승격). makePatch 는 현재 값 기반 변환(회전/이동 누적 등)도 지원.
  const patchSelected = (makePatch: (placement: WorkingPlacement) => Partial<WorkingPlacement>) => {
    setWorking((previous) => {
      const present = new Set(previous.map((placement) => placement.localId))
      const next = previous.map((placement) =>
        selectedIdSet.has(placement.localId) ? { ...placement, ...makePatch(placement) } : placement,
      )
      for (const id of selectedIds) {
        if (!present.has(id)) {
          const auto = autoById.get(id)
          if (auto) {
            next.push({ ...auto, ...makePatch(auto) })
          }
        }
      }
      return next
    })
  }

  // 키보드 미세 이동(②) — 선택 전체를 px 만큼 이동. 효과 의존성 안정용 useCallback.
  const nudgeSelected = useCallback(
    (dxPx: number, dyPx: number) => {
      setWorking((previous) => {
        const present = new Set(previous.map((placement) => placement.localId))
        const next = previous.map((placement) =>
          selectedIdSet.has(placement.localId)
            ? { ...placement, xPx: placement.xPx + dxPx, yPx: placement.yPx + dyPx }
            : placement,
        )
        for (const id of selectedIds) {
          if (!present.has(id)) {
            const auto = autoById.get(id)
            if (auto) {
              next.push({ ...auto, xPx: auto.xPx + dxPx, yPx: auto.yPx + dyPx })
            }
          }
        }
        return next
      })
    },
    [selectedIds, selectedIdSet, autoById],
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
    const ids = selectedIds.includes(localId) ? selectedIds : [localId]
    const start = new Map<string, { xPx: number; yPx: number }>()
    for (const id of ids) {
      const placement = allPlacements.find((item) => item.localId === id)
      if (placement) {
        start.set(id, { xPx: placement.xPx, yPx: placement.yPx })
      }
    }
    const anchor = allPlacements.find((item) => item.localId === localId)
    dragStartRef.current = anchor ? { ids, start, anchorXPx: anchor.xPx, anchorYPx: anchor.yPx } : null
  }

  const handleDragMove = (localId: string, worldX: number, worldZ: number) => {
    const [hitXPx, hitYPx] = worldToPlacement(worldX, worldZ)
    const drag = dragStartRef.current
    if (!drag) {
      patchWorking(localId, { xPx: hitXPx, yPx: hitYPx })
      return
    }
    const dxPx = hitXPx - drag.anchorXPx
    const dyPx = hitYPx - drag.anchorYPx
    setWorking((previous) => {
      const present = new Set(previous.map((placement) => placement.localId))
      const next = previous.map((placement) => {
        const snapshot = drag.start.get(placement.localId)
        return snapshot ? { ...placement, xPx: snapshot.xPx + dxPx, yPx: snapshot.yPx + dyPx } : placement
      })
      for (const id of drag.ids) {
        if (!present.has(id)) {
          const auto = autoById.get(id)
          const snapshot = drag.start.get(id)
          if (auto && snapshot) {
            next.push({ ...auto, xPx: snapshot.xPx + dxPx, yPx: snapshot.yPx + dyPx })
          }
        }
      }
      return next
    })
  }

  const handleDragEnd = () => {
    dragStartRef.current = null
  }

  const handleAdd = () => {
    const objectKey = Number(addObjectKey)
    // 0 = 미선택 sentinel. 빌트인 구조물은 음수 키라 추가 허용(저장 시 실 객체로 치환).
    if (!Number.isInteger(objectKey) || objectKey === 0) {
      setStatus('Pick an object to add.')
      return
    }
    const localId = nextLocalId()
    // 새 객체는 보고 있는 층에 추가(전체 보기면 1층). 이후 선택 패널 층 버튼으로 이동 가능.
    const addFloor = floorView === 'all' ? 1 : floorView
    setWorking((previous) => [
      ...previous,
      { localId, placementKey: null, objectKey, eqpKey: null, xPx: 675, yPx: 355, rotationDeg: 0, floor: addFloor },
    ])
    setSelectedIds([localId])
    setStatus(null)
  }

  const rotateSelected = (deltaDeg: number) => patchSelected((placement) => ({ rotationDeg: placement.rotationDeg + deltaDeg }))
  const setFloorForSelected = (floor: number) => patchSelected(() => ({ floor }))
  const assignTemplateToPrimary = (objectKey: number) => {
    if (primaryId) {
      patchWorking(primaryId, { objectKey })
    }
  }
  const bindEqpToPrimary = (eqpKey: number | null) => {
    if (primaryId) {
      patchWorking(primaryId, { eqpKey })
    }
  }

  const deleteSelected = () => {
    if (selectedIds.length === 0) {
      return
    }
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
      setStatus('Layout saved.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save layout failed.')
    }
  }

  return (
    <section data-testid="live-map-3d-scene" className="relative h-[calc(100dvh-16rem)] min-h-[440px] overflow-hidden rounded-[24px] border border-border bg-card shadow-soft-lg">
      {/* frameloop=demand — 연속 rAF 루프 대신 상호작용/상태변화 시에만 렌더(병렬 e2e teardown 안정 + 부하↓).
          dpr 캡(레티나 과샘플 방지) + 그림자맵 1024 로 3D 진입/조작 렌더 부하를 낮춘다. */}
      <Canvas
        frameloop="demand"
        shadows
        dpr={[1, 1.5]}
        gl={{ powerPreference: 'high-performance' }}
        orthographic
        camera={{ position: [16, 16, 16], zoom: 32, near: -200, far: 200 }}
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
        />
      </Canvas>

      {/* 상태 뱃지 — 단일 DOM 오버레이(plain 버튼 N개). 위치는 BadgeProjector 가 매 프레임 transform 으로 갱신.
          drei Html 포털 N개 제거 → 진입 비용↓. 항상표시 라벨·뱃지클릭 선택 유지. */}
      <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden">
        {visibleEquipForBadge.map((badge) => {
          const isSelected = selectedIdSet.has(badge.localId)
          const color = LIVE_MAP_STATUS_COLOR[badge.status]
          return (
            <button
              key={badge.localId}
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
              onClick={(event) => selectPlacement(badge.localId, event.shiftKey || event.ctrlKey || event.metaKey)}
              className={`pointer-events-auto absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap rounded-full border font-bold shadow-soft-md transition-transform ${
                isSelected ? 'z-[1] scale-125 border-2 px-3 py-1 text-[12px]' : 'px-2 py-0.5 text-[10px]'
              }`}
              style={{
                transform: 'translate(-9999px, -9999px)',
                borderColor: color,
                color: isSelected ? '#ffffff' : color,
                background: isSelected ? color : palette.badgeBg,
              }}
            >
              <span className="size-1.5 rounded-full" style={{ background: isSelected ? '#ffffff' : color }} />
              {badge.eqpId} · {badge.statusLabel}
            </button>
          )
        })}
      </div>

      {/* 상단 우측 — 편집 토글 + 저장 */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <span
          title="표시 = 화면에 그려진 전체(저장된 배치 + 라인 실설비 자동표시) · 저장 = DB에 영속된 배치 수"
          className="rounded-pill border border-border bg-card/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur"
        >
          표시 <span data-testid="live-map-3d-visible-count">{resolved.length}</span> · 저장{' '}
          <span data-testid="live-map-3d-placement-count">{working.length}</span>
        </span>
        {canEdit ? (
          <>
            <button
              type="button"
              data-testid="live-map-3d-edit-toggle"
              aria-pressed={editing}
              onClick={() => {
                setEditing((value) => !value)
                setSelectedIds([])
              }}
              title={editing ? '편집 모드 종료' : '배치 편집 시작'}
              className={`rounded-pill px-4 py-1.5 text-[12px] font-bold transition-colors ${
                editing ? 'bg-brand-primary text-white hover:bg-brand-primary/90' : 'border border-border bg-card/90 text-foreground backdrop-blur hover:bg-muted'
              }`}
            >
              {editing ? '편집 종료' : '편집'}
            </button>
            {editing ? (
              <button
                type="button"
                data-testid="live-map-3d-save"
                onClick={handleSave}
                disabled={saveLayout.isPending || createObject.isPending}
                title="배치 저장"
                className="rounded-pill bg-primary px-4 py-1.5 text-[12px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                저장
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {/* 층 뷰(④) — 항상 노출. 특정 층은 그 층만(바닥 평탄화) 보기, 전체는 적층. 편집 중 새 추가는 보고 있는 층에 들어간다. */}
      <div data-testid="live-map-3d-floors" className="absolute left-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-[14px] border border-border bg-card/90 p-1 shadow-soft-md backdrop-blur">
        {/* 위에서부터 3F·2F·1F (건물 은유) + 맨 아래 전체. */}
        {[...FLOOR_LEVELS].reverse().map((floor) => (
          <button
            key={floor}
            type="button"
            data-testid={`live-map-3d-floor-${floor}`}
            aria-pressed={floorView === floor}
            onClick={() => setFloorView(floor)}
            title={`${floor}층만 보기`}
            className={`size-9 rounded-md text-xs font-bold transition-colors ${
              floorView === floor ? 'bg-brand-primary text-white' : 'text-foreground hover:bg-muted'
            }`}
          >
            {floor}F
          </button>
        ))}
        <button
          type="button"
          data-testid="live-map-3d-floor-all"
          aria-pressed={floorView === 'all'}
          onClick={() => setFloorView('all')}
          title="전체 층 보기"
          className={`flex h-9 items-center justify-center rounded-md px-1 text-[11px] font-bold transition-colors ${
            floorView === 'all' ? 'bg-brand-primary text-white' : 'text-foreground hover:bg-muted'
          }`}
        >
          전체
        </button>
      </div>

      {/* 편집 — 추가 패널 */}
      {editing ? (
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-[14px] border border-border bg-card/90 px-3 py-2 shadow-soft-md backdrop-blur">
          <select
            data-testid="live-map-3d-add-select"
            className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/50"
            value={addObjectKey}
            onChange={(event) => setAddObjectKey(event.target.value)}
          >
            <option value="">— object —</option>
            {libraryObjects.map((object) => (
              <option key={object.objectKey} value={object.objectKey}>
                {object.objectName} ({object.objectKind})
              </option>
            ))}
          </select>
          <button type="button" data-testid="live-map-3d-add" onClick={handleAdd} title={`${floorView === 'all' ? 1 : floorView}층에 선택 객체 추가`} className="rounded-md border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
            추가
          </button>
        </div>
      ) : null}

      {/* 편집 — 선택 객체 패널 */}
      {editing && primary ? (
        <div data-testid="live-map-3d-selected" className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-[16px] border border-primary/40 bg-card/95 px-3 py-2 shadow-soft-lg backdrop-blur">
          <span className="text-xs font-bold text-foreground">
            {primaryObject?.objectName ?? primaryEquipment?.eqpName ?? 'object'}
            {selectedIds.length > 1 ? (
              <span data-testid="live-map-3d-selected-count" className="ml-1 font-semibold text-muted-foreground">
                외 {selectedIds.length - 1}개
              </span>
            ) : null}
          </span>
          <button type="button" data-testid="live-map-3d-rotate-ccw" onClick={() => rotateSelected(-ROTATE_STEP)} title="반시계 15° 회전" aria-label="반시계 15° 회전" className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-muted">
            ⟲
          </button>
          <button type="button" data-testid="live-map-3d-rotate-cw" onClick={() => rotateSelected(ROTATE_STEP)} title="시계 15° 회전" aria-label="시계 15° 회전" className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-muted">
            ⟳
          </button>
          {/* 선택을 다른 층으로 이동 */}
          <div className="flex items-center gap-0.5" role="group" aria-label="층 이동">
            {FLOOR_LEVELS.map((floor) => (
              <button
                key={floor}
                type="button"
                data-testid={`live-map-3d-set-floor-${floor}`}
                onClick={() => setFloorForSelected(floor)}
                title={`${floor}층으로 이동`}
                className={`size-7 rounded-md border text-xs font-semibold transition-colors ${
                  primary.floor === floor ? 'border-primary bg-primary/15 text-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {floor}
              </button>
            ))}
          </div>
          {assignCandidates.length > 0 ? (
            <select
              data-testid="live-map-3d-assign-select"
              title="객체 템플릿 교체"
              className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/50"
              value={primary.objectKey}
              onChange={(event) => assignTemplateToPrimary(Number(event.target.value))}
            >
              {assignCandidates.map((object) => (
                <option key={object.objectKey} value={object.objectKey}>
                  {object.objectName}
                </option>
              ))}
            </select>
          ) : null}
          {isEquipmentPrimary ? (
            <select
              data-testid="live-map-3d-eqp-select"
              title="실설비 바인딩"
              className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/50"
              value={primary.eqpKey ?? ''}
              onChange={(event) => bindEqpToPrimary(event.target.value === '' ? null : Number(event.target.value))}
            >
              <option value="">— equipment —</option>
              {lineEquipments.map((equipment) => (
                <option key={equipment.eqpKey} value={equipment.eqpKey}>
                  {equipment.eqpName}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" data-testid="live-map-3d-delete" onClick={deleteSelected} title="선택 배치 삭제" className="rounded-full border border-danger px-3 py-1 text-xs font-semibold text-danger transition-colors hover:bg-danger/10">
            삭제
          </button>
        </div>
      ) : null}

      {/* 선택 설비 상세(R5) — 뷰어와 동일한 LiveMapTooltipCard(속성/포트/통신로그). top-16~bottom-4 로 통신로그 flex 높이 확보. */}
      {selectedNode ? (
        <div data-testid="live-map-3d-detail" className="absolute right-4 top-16 bottom-4 z-10 w-[330px]">
          <LiveMapTooltipCard equipment={selectedNode} onClose={() => setSelectedIds([])} />
        </div>
      ) : null}

      {/* 조작 힌트 — OrbitControls 기본 매핑(좌:회전 / 우:이동 / 휠:확대)이라 화면 이동(pan)이 우드래그/두손가락임을 안내. */}
      <div
        data-testid="live-map-3d-controls-hint"
        className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-pill border border-border bg-card/80 px-3 py-1 text-[10px] font-semibold text-muted-foreground backdrop-blur"
      >
        {editing
          ? 'Shift+클릭 다중 선택 · 드래그/화살표 이동 · 우드래그 화면 이동'
          : '드래그 회전 · 우드래그·두손가락 화면 이동 · 휠 확대/축소'}
      </div>

      {status ? (
        <div data-testid="live-map-3d-status" className="absolute bottom-4 right-4 z-10 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur">
          {status}
        </div>
      ) : null}
    </section>
  )
}
