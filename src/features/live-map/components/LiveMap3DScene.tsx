import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useMe } from '@/features/profile/hooks/useProfile'
import { hasPermission, LIVE_MAP_LAYOUT_WRITE_PERMISSION } from '@/shared/lib/permission'
import type { LiveMapObjectResponse } from '../api/layout.api'
import { useLayout, useLayoutObjects, useSaveLayout } from '../hooks/useLayout'
import { buildTransformJson, DEFAULT_CANVAS_JSON } from '../lib/live-map-layout.model'
import {
  isLiveMap3DShape,
  placementToWorld,
  worldToPlacement,
  type LiveMap3DShape,
} from '../lib/live-map-3d.model'
import { LiveMap3DObject } from './LiveMap3DObject'

interface LiveMap3DSceneProps {
  lineKey: number | null
}

/** 편집 중 작업 사본 — 배치 1건. placementKey 는 신규(추가) 시 null. */
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
  shape: LiveMap3DShape
}

const ROTATE_STEP = 15

/** Canvas 내부 — useThree 로 바닥 드래그(수동 ray-plane 교차 + 포인터 캡처) 처리. */
function SceneContent({
  placements,
  selectedId,
  editing,
  onSelect,
  onDragMove,
}: {
  placements: ResolvedPlacement[]
  selectedId: string | null
  editing: boolean
  onSelect: (localId: string | null) => void
  onDragMove: (localId: string, worldX: number, worldZ: number) => void
}) {
  const { gl, camera, raycaster } = useThree()
  const [controlsEnabled, setControlsEnabled] = useState(true)
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
        setControlsEnabled(true)
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
    setControlsEnabled(false)
  }

  return (
    <>
      <color attach="background" args={['#0e1422']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[12, 20, 8]} intensity={1.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#0b0f1a" />
      </mesh>
      <Grid args={[120, 120]} cellSize={1} cellColor="#1e2638" sectionSize={5} sectionColor="#334155" infiniteGrid fadeDistance={52} fadeStrength={1.4} />
      {placements.map((placement) => {
        const [worldX, worldZ] = placementToWorld(placement.xPx, placement.yPx)
        const isSelected = placement.localId === selectedId
        return (
          <group key={placement.localId} position={[worldX, 0, worldZ]} rotation={[0, (placement.rotationDeg * Math.PI) / 180, 0]}>
            <group onPointerDown={handlePointerDown(placement.localId)}>
              <LiveMap3DObject shape={placement.shape} />
            </group>
            {isSelected ? (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                <ringGeometry args={[1.6, 1.9, 36]} />
                <meshBasicMaterial color="#22d3ee" transparent opacity={0.85} />
              </mesh>
            ) : null}
          </group>
        )
      })}
      <OrbitControls enabled={controlsEnabled} target={[0, 0, 0]} makeDefault />
    </>
  )
}

/**
 * live-map 3D 등각 뷰어 씬 — SPEC live-map-3d Phase 1(읽기전용) + Phase 3(admin 배치 편집).
 *
 * <p>편집모드: 객체를 바닥에서 드래그 이동, 라이브러리에서 추가, 회전/삭제, 설비 객체(템플릿) 교체.
 * 저장 시 PUT /live-map/layout 로 영속. v1(Konva) 객체는 3D 에서 무시.</p>
 */
export function LiveMap3DScene({ lineKey }: LiveMap3DSceneProps) {
  const layoutQuery = useLayout(lineKey)
  const meQuery = useMe()
  const canEdit = hasPermission(meQuery.data?.permissionCodes, LIVE_MAP_LAYOUT_WRITE_PERMISSION)
  const objectsQuery = useLayoutObjects(canEdit)
  const saveLayout = useSaveLayout(lineKey)

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

  // 서버 layout 이 바뀌면 작업 사본 재시드(저장 후/라인 전환/새로고침).
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

  // 라이브러리 + layout 객체 병합(배치는 layout 객체 참조, 추가/교체는 라이브러리 참조).
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

  // v2(3D) 객체를 가진 배치만 렌더 대상으로 해석.
  const resolved = useMemo(() => {
    const items: ResolvedPlacement[] = []
    for (const placement of working) {
      const object = objectsByKey.get(placement.objectKey)
      if (!object || !isLiveMap3DShape(object.shapeJson)) {
        continue
      }
      items.push({ ...placement, shape: object.shapeJson })
    }
    return items
  }, [working, objectsByKey])

  // 추가 후보(라이브러리의 v2 객체).
  const libraryObjects = useMemo(
    () => (objectsQuery.data ?? []).filter((object) => isLiveMap3DShape(object.shapeJson)),
    [objectsQuery.data],
  )

  const selected = working.find((placement) => placement.localId === selectedId) ?? null
  const selectedObject = selected ? objectsByKey.get(selected.objectKey) ?? null : null
  // 같은 종류 객체로만 교체 후보 제시.
  const assignCandidates = useMemo(
    () => libraryObjects.filter((object) => object.objectKind === selectedObject?.objectKind),
    [libraryObjects, selectedObject?.objectKind],
  )

  const handleDragMove = (localId: string, worldX: number, worldZ: number) => {
    const [xPx, yPx] = worldToPlacement(worldX, worldZ)
    setWorking((previous) => previous.map((placement) => (placement.localId === localId ? { ...placement, xPx, yPx } : placement)))
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

  const rotateSelected = (deltaDeg: number) => {
    if (!selected) {
      return
    }
    setWorking((previous) =>
      previous.map((placement) =>
        placement.localId === selected.localId ? { ...placement, rotationDeg: placement.rotationDeg + deltaDeg } : placement,
      ),
    )
  }

  const assignSelected = (objectKey: number) => {
    if (!selected) {
      return
    }
    setWorking((previous) =>
      previous.map((placement) => (placement.localId === selected.localId ? { ...placement, objectKey } : placement)),
    )
  }

  const deleteSelected = () => {
    if (!selected) {
      return
    }
    setWorking((previous) => previous.filter((placement) => placement.localId !== selected.localId))
    setSelectedId(null)
  }

  const handleSave = () => {
    saveLayout.mutate(
      {
        canvasJson: layoutQuery.data?.canvasJson ?? DEFAULT_CANVAS_JSON,
        placements: working.map((placement) => ({
          objectKey: placement.objectKey,
          eqpKey: placement.eqpKey,
          transformJson: buildTransformJson({ x: placement.xPx, y: placement.yPx, rotation: placement.rotationDeg }),
        })),
      },
      {
        onSuccess: () => setStatus('Layout saved.'),
        onError: (error) => setStatus(error instanceof Error ? error.message : 'Save layout failed.'),
      },
    )
  }

  return (
    <section data-testid="live-map-3d-scene" className="relative h-[640px] overflow-hidden rounded-[24px] border border-border bg-card shadow-soft-lg">
      {/* frameloop=demand — 연속 rAF 루프 대신 상호작용/상태변화 시에만 렌더(병렬 e2e teardown 안정 + 부하↓). */}
      <Canvas frameloop="demand" shadows orthographic camera={{ position: [16, 16, 16], zoom: 46, near: -200, far: 200 }}>
        <SceneContent placements={resolved} selectedId={selectedId} editing={editing} onSelect={setSelectedId} onDragMove={handleDragMove} />
      </Canvas>

      {/* 상단 우측 — 편집 토글 + 저장 */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <span className="rounded-pill border border-border bg-card/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground backdrop-blur">
          placements <span data-testid="live-map-3d-placement-count">{working.length}</span>
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
              className={`rounded-pill px-4 py-1.5 text-[12px] font-bold transition-colors ${
                editing ? 'bg-brand-primary text-white' : 'border border-border bg-card/90 text-foreground backdrop-blur'
              }`}
            >
              {editing ? '편집 중' : '편집'}
            </button>
            {editing ? (
              <button
                type="button"
                data-testid="live-map-3d-save"
                onClick={handleSave}
                className="rounded-pill bg-primary px-4 py-1.5 text-[12px] font-bold text-primary-foreground"
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
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
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
          <button type="button" data-testid="live-map-3d-add" onClick={handleAdd} className="rounded-md border border-primary px-3 py-1 text-xs font-semibold text-primary">
            추가
          </button>
        </div>
      ) : null}

      {/* 편집 — 선택 객체 패널 */}
      {editing && selected ? (
        <div data-testid="live-map-3d-selected" className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-[16px] border border-primary/40 bg-card/95 px-3 py-2 shadow-soft-lg backdrop-blur">
          <span className="text-xs font-bold text-foreground">{selectedObject?.objectName ?? 'object'}</span>
          <button type="button" data-testid="live-map-3d-rotate-ccw" onClick={() => rotateSelected(-ROTATE_STEP)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
            ⟲
          </button>
          <button type="button" data-testid="live-map-3d-rotate-cw" onClick={() => rotateSelected(ROTATE_STEP)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
            ⟳
          </button>
          {assignCandidates.length > 0 ? (
            <select
              data-testid="live-map-3d-assign-select"
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              value={selected.objectKey}
              onChange={(event) => assignSelected(Number(event.target.value))}
            >
              {assignCandidates.map((object) => (
                <option key={object.objectKey} value={object.objectKey}>
                  {object.objectName}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" data-testid="live-map-3d-delete" onClick={deleteSelected} className="rounded-full border border-danger px-3 py-1 text-xs font-semibold text-danger">
            삭제
          </button>
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
