import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import type { LiveMapObjectResponse } from '../api/layout.api'
import { useLayout } from '../hooks/useLayout'
import { sortByDepth } from '../lib/live-map-layout.model'
import { isLiveMap3DShape, placementToWorld, type LiveMap3DShape } from '../lib/live-map-3d.model'
import { LiveMap3DObject } from './LiveMap3DObject'

interface LiveMap3DSceneProps {
  /** 선택 라인의 lineKey. null 이면 안내만 렌더. */
  lineKey: number | null
}

interface ScenePlacement {
  placementKey: number
  shape: LiveMap3DShape
  xPx: number
  yPx: number
  rotationDeg: number
  depth: number
  zIndex: number
}

/**
 * live-map 3D 등각 뷰어 씬(react-three-fiber)입니다 — SPEC live-map-3d Phase 1(읽기전용).
 *
 * <p>layout(objects+placements)에서 v2(3D) 객체를 가진 placement 를 등각 ortho 카메라로 렌더한다.
 * v1(Konva) 객체는 3D 에선 무시. 배치 편집/상태 뱃지/상세 패널은 다음 Phase.</p>
 */
export function LiveMap3DScene({ lineKey }: LiveMap3DSceneProps) {
  const layoutQuery = useLayout(lineKey)

  const objectsByKey = useMemo(() => {
    const map = new Map<number, LiveMapObjectResponse>()
    for (const object of layoutQuery.data?.objects ?? []) {
      map.set(object.objectKey, object)
    }
    return map
  }, [layoutQuery.data?.objects])

  const placements = useMemo(() => {
    const resolved: ScenePlacement[] = []
    for (const placement of layoutQuery.data?.placements ?? []) {
      const object = objectsByKey.get(placement.objectKey)
      if (!object || !isLiveMap3DShape(object.shapeJson)) {
        continue
      }
      resolved.push({
        placementKey: placement.placementKey,
        shape: object.shapeJson,
        xPx: placement.transformJson.x,
        yPx: placement.transformJson.y,
        rotationDeg: placement.transformJson.rotation,
        depth: placement.transformJson.depth,
        zIndex: placement.transformJson.zIndex,
      })
    }
    return sortByDepth(resolved)
  }, [layoutQuery.data?.placements, objectsByKey])

  return (
    <section
      data-testid="live-map-3d-scene"
      className="relative h-[640px] overflow-hidden rounded-[24px] border border-border bg-card shadow-soft-lg"
    >
      <Canvas
        shadows
        orthographic
        camera={{ position: [16, 16, 16], zoom: 46, near: -200, far: 200 }}
      >
        <color attach="background" args={['#0e1422']} />
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[12, 20, 8]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        {/* 바닥(그림자 수신) + 등각 그리드 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#0b0f1a" />
        </mesh>
        <Grid
          args={[80, 80]}
          cellSize={1}
          cellColor="#1e2638"
          sectionSize={5}
          sectionColor="#334155"
          infiniteGrid
          fadeDistance={48}
          fadeStrength={1.4}
        />
        {placements.map((placement) => {
          const [worldX, worldZ] = placementToWorld(placement.xPx, placement.yPx)
          return (
            <group
              key={placement.placementKey}
              position={[worldX, 0, worldZ]}
              rotation={[0, (placement.rotationDeg * Math.PI) / 180, 0]}
            >
              <LiveMap3DObject shape={placement.shape} />
            </group>
          )
        })}
        <OrbitControls target={[0, 0, 0]} enableDamping makeDefault />
      </Canvas>
    </section>
  )
}
