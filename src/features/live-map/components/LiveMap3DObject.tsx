import type { LiveMap3DPrim, LiveMap3DShape } from '../lib/live-map-3d.model'

/**
 * 3D 객체(shape_json v2)를 three 메시 묶음으로 렌더합니다 — 빌더(미리보기)와 뷰어 씬의 공용 해석.
 *
 * <p>기본 도형(box/cylinder/plane)만 매핑한다. 그룹 transform(바닥 위치/회전)은 상위 `<group>` 이 제공하고,
 * 여기선 각 prim 의 객체 로컬 위치/회전/크기/색만 그린다.</p>
 */

function Prim({ prim }: { prim: LiveMap3DPrim }) {
  const position: [number, number, number] = [prim.position.x, prim.position.y, prim.position.z]
  return (
    <mesh position={position} rotation={[0, prim.rotationY, 0]} castShadow receiveShadow>
      {prim.type === 'box' ? <boxGeometry args={[prim.size.x, prim.size.y, prim.size.z]} /> : null}
      {prim.type === 'cylinder' ? (
        <cylinderGeometry args={[prim.size.x / 2, prim.size.x / 2, prim.size.y, 24]} />
      ) : null}
      {prim.type === 'plane' ? <planeGeometry args={[prim.size.x, prim.size.z]} /> : null}
      <meshStandardMaterial color={prim.color} metalness={0.25} roughness={0.65} />
    </mesh>
  )
}

export function LiveMap3DObject({ shape }: { shape: LiveMap3DShape }) {
  return (
    <>
      {shape.prims.map((prim) => (
        <Prim key={prim.id} prim={prim} />
      ))}
    </>
  )
}
