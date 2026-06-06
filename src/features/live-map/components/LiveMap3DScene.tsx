import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Grid, Html, OrbitControls } from '@react-three/drei'
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
  isLiveMap3DShape,
  LIVE_MAP_STATUS_COLOR,
  placementToWorld,
  worldToPlacement,
  type LiveMap3DShape,
} from '../lib/live-map-3d.model'
import { LiveMap3DEquipment } from './LiveMap3DEquipment'
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
}

interface ResolvedPlacement extends WorkingPlacement {
  kind: LiveMapObjectResponse['objectKind']
  shape: LiveMap3DShape
  equipment: LiveMapEquipment | null
}

const ROTATE_STEP = 15

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

/** Canvas 내부 — 바닥 드래그(수동 ray-plane + 포인터 캡처) + 상태 뱃지. */
function SceneContent({
  placements,
  selectedId,
  editing,
  palette,
  onSelect,
  onDragMove,
}: {
  placements: ResolvedPlacement[]
  selectedId: string | null
  editing: boolean
  palette: ScenePalette
  onSelect: (localId: string | null) => void
  onDragMove: (localId: string, worldX: number, worldZ: number) => void
}) {
  const { gl, camera, raycaster } = useThree()
  const dragRef = useRef<{ localId: string; pointerId: number } | null>(null)
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

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
      if (raycaster.ray.intersectPlane(groundPlane, hit)) {
        onDragMove(drag.localId, hit.x, hit.z)
      }
    }
    const handleUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        element.releasePointerCapture?.(event.pointerId)
        dragRef.current = null
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
  }, [gl, camera, raycaster, groundPlane, onDragMove])

  const handlePointerDown = (localId: string) => (event: ThreeEvent<PointerEvent>) => {
    onSelect(localId)
    if (!editing) {
      return
    }
    event.stopPropagation()
    gl.domElement.setPointerCapture?.(event.pointerId)
    dragRef.current = { localId, pointerId: event.pointerId }
  }

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <hemisphereLight intensity={palette.hemi} groundColor={palette.hemiGround} color={palette.hemiSky} />
      <ambientLight intensity={palette.ambient} />
      <directionalLight position={[14, 22, 10]} intensity={1.15} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      {/* 전면 필 — 등각 카메라 쪽 면(설비 전면)이 어둠에 묻히지 않게. 그림자 없음. */}
      <directionalLight position={[6, 9, 18]} intensity={0.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color={palette.ground} metalness={0.1} roughness={0.95} />
      </mesh>
      <Grid args={[160, 160]} cellSize={1} cellColor={palette.gridCell} sectionSize={5} sectionColor={palette.gridSection} infiniteGrid fadeDistance={56} fadeStrength={1.3} />
      <ContactShadows position={[0, 0.01, 0]} opacity={palette.contactOpacity} scale={80} blur={2.2} far={22} resolution={512} />
      {placements.map((placement) => {
        const [worldX, worldZ] = placementToWorld(placement.xPx, placement.yPx)
        const isSelected = placement.localId === selectedId
        const equipment = placement.equipment
        return (
          <group key={placement.localId} position={[worldX, 0, worldZ]} rotation={[0, (placement.rotationDeg * Math.PI) / 180, 0]}>
            <group onPointerDown={handlePointerDown(placement.localId)}>
              {placement.kind === 'EQUIPMENT' ? (
                <LiveMap3DEquipment equipment={placement.equipment} />
              ) : (
                <LiveMap3DObject shape={placement.shape} />
              )}
            </group>
            {isSelected ? (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                <ringGeometry args={[1.95, 2.25, 40]} />
                <meshBasicMaterial color="#22d3ee" transparent opacity={0.85} />
              </mesh>
            ) : null}
            {equipment ? (
              <Html position={[0, 2.95, 0]} center>
                <button
                  type="button"
                  data-testid={`live-map-3d-badge-${equipment.eqpKey}`}
                  onClick={() => onSelect(placement.localId)}
                  className="flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-soft-md"
                  style={{ borderColor: LIVE_MAP_STATUS_COLOR[equipment.status], color: LIVE_MAP_STATUS_COLOR[equipment.status], background: palette.badgeBg }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: LIVE_MAP_STATUS_COLOR[equipment.status] }} />
                  {equipment.eqpId} · {equipment.statusLabel}
                </button>
              </Html>
            ) : null}
          </group>
        )
      })}
      {/* 편집 모드에선 카메라 회전(좌드래그)을 끈다 — 설비 좌드래그 이동과 orbit 충돌 방지. pan(우드래그)/zoom(휠)은 유지. */}
      <OrbitControls enableRotate={!editing} target={[0, 0, 0]} makeDefault />
    </>
  )
}

/**
 * live-map 3D 등각 뷰어 씬 — SPEC live-map-3d Phase 1(읽기전용) + Phase 3(배치 편집) + Phase 4(설비 바인딩/상태/상세).
 *
 * <p>편집모드: 바닥 드래그 이동 · 라이브러리 추가 · 회전/삭제 · 템플릿 교체 · 실설비(eqpKey) 바인딩 → PUT 영속.
 * 뷰어: 바인딩된 설비의 실시간 상태 뱃지 + 선택 시 상세 패널. v1(Konva) 객체는 3D 에서 무시.</p>
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

  const [editing, setEditing] = useState(false)
  const [working, setWorking] = useState<WorkingPlacement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addObjectKey, setAddObjectKey] = useState<string>('')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const placements = layoutQuery.data?.placements ?? []
    setSelectedId(null)
    setWorking(
      placements.map((placement) => ({
        localId: nextLocalId(),
        placementKey: placement.placementKey,
        objectKey: placement.objectKey,
        eqpKey: placement.eqpKey,
        xPx: placement.transformJson.x,
        yPx: placement.transformJson.y,
        rotationDeg: placement.transformJson.rotation,
      })),
    )
  }, [layoutQuery.data])

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
    }))
  }, [lineEquipments, placedEqpKeys])

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

  const libraryObjects = useMemo(
    () => (objectsQuery.data ?? []).filter((object) => isLiveMap3DShape(object.shapeJson)),
    [objectsQuery.data],
  )

  const selected = allPlacements.find((placement) => placement.localId === selectedId) ?? null
  const selectedObject = selected ? objectsByKey.get(selected.objectKey) ?? null : null
  const isEquipmentSelected = selectedObject?.objectKind === 'EQUIPMENT'
  const selectedEquipment = selected?.eqpKey != null ? equipmentByKey.get(selected.eqpKey) ?? null : null
  // 뷰어와 동일한 상세(LiveMapTooltipCard)를 쓰기 위해 선택 설비를 보드 노드로 변환(eqpId 매칭).
  const equipmentNodes = useMemo(
    () => buildLiveMapEquipmentNodes(liveMapQuery.data?.equipmentItems ?? [], LIVE_MAP_CLUSTER_ITEMS),
    [liveMapQuery.data?.equipmentItems],
  )
  const selectedNode = useMemo(
    () => (selectedEquipment ? equipmentNodes.find((node) => node.eqpId === selectedEquipment.eqpId) ?? null : null),
    [equipmentNodes, selectedEquipment],
  )
  const assignCandidates = useMemo(
    () => libraryObjects.filter((object) => object.objectKind === selectedObject?.objectKind),
    [libraryObjects, selectedObject?.objectKind],
  )

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

  const handleDragMove = (localId: string, worldX: number, worldZ: number) => {
    const [xPx, yPx] = worldToPlacement(worldX, worldZ)
    patchWorking(localId, { xPx, yPx })
  }

  const handleAdd = () => {
    const objectKey = Number(addObjectKey)
    if (!Number.isInteger(objectKey) || objectKey <= 0) {
      setStatus('Pick an object to add.')
      return
    }
    const localId = nextLocalId()
    setWorking((previous) => [
      ...previous,
      { localId, placementKey: null, objectKey, eqpKey: null, xPx: 675, yPx: 355, rotationDeg: 0 },
    ])
    setSelectedId(localId)
    setStatus(null)
  }

  const updateSelected = (patch: Partial<WorkingPlacement>) => {
    if (!selected) {
      return
    }
    patchWorking(selected.localId, patch)
  }

  const deleteSelected = () => {
    if (!selected) {
      return
    }
    setWorking((previous) => previous.filter((placement) => placement.localId !== selected.localId))
    setSelectedId(null)
  }

  // object_key 가 NOT NULL FK 라, 자동 표시(objectKey 0) 설비를 저장하려면 백킹 EQUIPMENT 객체가 1개 필요.
  // 라이브러리에 EQUIPMENT 객체가 있으면 재사용, 없으면 1회 생성.
  const ensureEquipmentObjectKey = async (): Promise<number> => {
    const existing = libraryObjects.find((object) => object.objectKind === 'EQUIPMENT')
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

  const handleSave = async () => {
    try {
      const needsBackingObject = working.some((placement) => placement.objectKey === AUTO_OBJECT_KEY)
      const equipmentObjectKey = needsBackingObject ? await ensureEquipmentObjectKey() : AUTO_OBJECT_KEY
      await saveLayout.mutateAsync({
        canvasJson: layoutQuery.data?.canvasJson ?? DEFAULT_CANVAS_JSON,
        placements: working.map((placement) => ({
          objectKey: placement.objectKey === AUTO_OBJECT_KEY ? equipmentObjectKey : placement.objectKey,
          eqpKey: placement.eqpKey,
          transformJson: buildTransformJson({ x: placement.xPx, y: placement.yPx, rotation: placement.rotationDeg }),
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
        camera={{ position: [16, 16, 16], zoom: 46, near: -200, far: 200 }}
      >
        <SceneContent placements={resolved} selectedId={selectedId} editing={editing} palette={palette} onSelect={setSelectedId} onDragMove={handleDragMove} />
      </Canvas>

      {/* 상단 우측 — 편집 토글 + 저장 */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <span className="rounded-pill border border-border bg-card/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur">
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
                setSelectedId(null)
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
          <button type="button" data-testid="live-map-3d-add" onClick={handleAdd} title="선택한 객체를 바닥에 추가" className="rounded-md border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
            추가
          </button>
        </div>
      ) : null}

      {/* 편집 — 선택 객체 패널 */}
      {editing && selected ? (
        <div data-testid="live-map-3d-selected" className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-[16px] border border-primary/40 bg-card/95 px-3 py-2 shadow-soft-lg backdrop-blur">
          <span className="text-xs font-bold text-foreground">{selectedObject?.objectName ?? selectedEquipment?.eqpName ?? 'object'}</span>
          <button type="button" data-testid="live-map-3d-rotate-ccw" onClick={() => updateSelected({ rotationDeg: selected.rotationDeg - ROTATE_STEP })} title="반시계 15° 회전" aria-label="반시계 15° 회전" className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-muted">
            ⟲
          </button>
          <button type="button" data-testid="live-map-3d-rotate-cw" onClick={() => updateSelected({ rotationDeg: selected.rotationDeg + ROTATE_STEP })} title="시계 15° 회전" aria-label="시계 15° 회전" className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-muted">
            ⟳
          </button>
          {assignCandidates.length > 0 ? (
            <select
              data-testid="live-map-3d-assign-select"
              title="객체 템플릿 교체"
              className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/50"
              value={selected.objectKey}
              onChange={(event) => updateSelected({ objectKey: Number(event.target.value) })}
            >
              {assignCandidates.map((object) => (
                <option key={object.objectKey} value={object.objectKey}>
                  {object.objectName}
                </option>
              ))}
            </select>
          ) : null}
          {isEquipmentSelected ? (
            <select
              data-testid="live-map-3d-eqp-select"
              title="실설비 바인딩"
              className="cursor-pointer rounded-md border border-border bg-background px-2 py-1 text-xs transition-colors hover:border-primary/50"
              value={selected.eqpKey ?? ''}
              onChange={(event) => updateSelected({ eqpKey: event.target.value === '' ? null : Number(event.target.value) })}
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
          <LiveMapTooltipCard equipment={selectedNode} onClose={() => setSelectedId(null)} />
        </div>
      ) : null}

      {status ? (
        <div data-testid="live-map-3d-status" className="absolute bottom-4 right-4 z-10 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur">
          {status}
        </div>
      ) : null}
    </section>
  )
}
