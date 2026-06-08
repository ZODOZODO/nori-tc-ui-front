import { useLayoutEffect, useMemo, useRef } from 'react'
import { RoundedBoxGeometry } from 'three-stdlib'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { LiveMapEquipmentResponse, LiveMapPortResponse } from '../api/live-map.api'
import { LIVE_MAP_PORT_COLOR, LIVE_MAP_STATUS_COLOR } from '../lib/live-map-3d.model'

/**
 * 설비 다수를 manual InstancedMesh 로 렌더 — 부품 종류당 React 엘리먼트 1개 + draw call 1개라 설비 수(54/100/1000)와
 * 무관하게 O(부품종류). 인스턴스 행렬/색은 useLayoutEffect 에서 JS 루프로 `setMatrixAt`/`setColorAt`(값싼) → 층 전환·
 * 드래그 시 React 재조정 없이 행렬만 갱신(drei `<Instance>` 의 O(N×부품) React 엘리먼트 문제 제거).
 *
 * <p>부품 로컬 위치를 설비의 (world 위치 + Y회전)으로 변환해 instance 행렬에 넣는다. 상태/포트 색은 `setColorAt`
 * (instanceColor, base 흰색 머티리얼과 곱). 발광 글로우는 instanceColor 로 표현 불가 → 평면 색(스케일 우선). 선택/드래그는
 * 본체(mainframe) InstancedMesh 의 onPointerDown → `event.instanceId` 로 placement 매핑. 뱃지/선택링은 상위가 따로 그림.</p>
 */

const TOOL = { width: 2.0, mainframeH: 1.72, mainframeD: 1.05, efemH: 1.04, efemD: 0.66 }
const PLINTH_H = 0.1
const TOTAL_D = TOOL.mainframeD + TOOL.efemD
const FRONT_Z = TOTAL_D / 2
const MAINFRAME_Z = FRONT_Z - TOOL.efemD - TOOL.mainframeD / 2
const EFEM_Z = FRONT_Z - TOOL.efemD / 2
const MAINFRAME_TOP_Y = PLINTH_H + TOOL.mainframeH
const FOUP = { width: 0.4, height: 0.48, depth: 0.42 }
const DOCK = { height: 0.08, protrude: 0.16 }
const DOCK_Y = PLINTH_H + 0.3

const COLOR = {
  body: '#e3e7eb', efem: '#d2d7dd', trim: '#2a3340', glass: '#0c1622',
  chamber: '#4a525f', chamberLid: '#69727f', hub: '#59626f', dock: '#39414e',
  foup: '#aab3c0', panel: '#c0c6cd',
}

// 부품 종류당 1회 생성 공유 지오메트리(설비 수와 무관). 포트는 단위 폭 1 → per-instance scale.x.
const GEO = {
  plinth: new THREE.BoxGeometry(TOOL.width + 0.12, PLINTH_H, TOTAL_D + 0.12),
  mainframe: new RoundedBoxGeometry(TOOL.width, TOOL.mainframeH, TOOL.mainframeD, 2, 0.05),
  panel: new THREE.BoxGeometry(TOOL.width * 0.72, TOOL.mainframeH * 0.6, 0.02),
  accent: new THREE.BoxGeometry(TOOL.width * 0.72, 0.06, 0.02),
  hub: new THREE.CylinderGeometry(0.34, 0.36, 0.3, 6),
  module: new THREE.CylinderGeometry(0.21, 0.22, 0.34, 14),
  lid: new THREE.CylinderGeometry(0.16, 0.21, 0.06, 14),
  efem: new RoundedBoxGeometry(TOOL.width, TOOL.efemH, TOOL.efemD, 2, 0.04),
  glass: new THREE.BoxGeometry(TOOL.width * 0.84, 0.3, 0.03),
  towerPole: new THREE.CylinderGeometry(0.035, 0.05, 0.16, 10),
  towerSeg: new THREE.CylinderGeometry(0.075, 0.075, 0.14, 12),
  dock: new THREE.BoxGeometry(1, DOCK.height, DOCK.protrude + 0.18),
  foup: new RoundedBoxGeometry(1, FOUP.height, FOUP.depth, 2, 0.03),
  band: new THREE.BoxGeometry(1, 0.07, 0.02),
}
const fixedMat = (color: string, metalness: number, roughness: number) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness })
const tintMat = (metalness: number, roughness: number) =>
  new THREE.MeshStandardMaterial({ color: '#ffffff', metalness, roughness })
const MAT = {
  plinth: fixedMat(COLOR.trim, 0.4, 0.55),
  body: fixedMat(COLOR.body, 0.2, 0.42),
  panel: fixedMat(COLOR.panel, 0.2, 0.5),
  hub: fixedMat(COLOR.hub, 0.5, 0.4),
  chamber: fixedMat(COLOR.chamber, 0.45, 0.4),
  chamberLid: fixedMat(COLOR.chamberLid, 0.55, 0.35),
  efem: fixedMat(COLOR.efem, 0.22, 0.44),
  glass: new THREE.MeshStandardMaterial({ color: COLOR.glass, emissive: new THREE.Color('#1f7a8c'), emissiveIntensity: 0.4, toneMapped: false, metalness: 0.1, roughness: 0.3 }),
  towerPole: fixedMat(COLOR.trim, 0.6, 0.35),
  accent: tintMat(0.3, 0.5),
  tower: tintMat(0.4, 0.4),
  dock: fixedMat(COLOR.dock, 0.5, 0.4),
  foup: fixedMat(COLOR.foup, 0.2, 0.5),
  band: tintMat(0.2, 0.5),
}

const MODULES: Array<[number, number]> = [
  [0, -0.34],
  [-0.5, 0.06],
  [0.5, 0.06],
]
const ACCENT_OFF = '#11161d'
const TOWER_OFF = '#1b2026'
const TOWER_COLORS = ['#ef4444', '#f59e0b', '#22c55e'] as const
const towerOn = (status: LiveMapEquipmentResponse['status']) => [status === 'ERROR', status === 'IDLE', status === 'RUN']

export interface FieldPlacement {
  localId: string
  worldX: number
  worldZ: number
  floorY: number
  rotationDeg: number
  status: LiveMapEquipmentResponse['status']
  ports: LiveMapPortResponse[]
}

interface PartInstance {
  px: number
  py: number
  pz: number
  ry: number
  sx?: number
  color?: string
}

/** 설비 로컬 (lx,ly,lz) 를 Y회전 θ + world 평행이동으로 절대 좌표화. */
const place = (p: FieldPlacement, lx: number, ly: number, lz: number): [number, number, number] => {
  const t = (p.rotationDeg * Math.PI) / 180
  const cos = Math.cos(t)
  const sin = Math.sin(t)
  return [p.worldX + lx * cos + lz * sin, p.floorY + ly, p.worldZ - lx * sin + lz * cos]
}
const rad = (p: FieldPlacement) => (p.rotationDeg * Math.PI) / 180

const portLayout = (ports: LiveMapPortResponse[]): { foupWidth: number; xs: number[] } => {
  if (ports.length === 0) return { foupWidth: FOUP.width, xs: [] }
  const usableWidth = TOOL.width * 0.9
  const slotWidth = usableWidth / ports.length
  const foupWidth = Math.min(FOUP.width, slotWidth * 0.74)
  const startX = -usableWidth / 2 + slotWidth / 2
  return { foupWidth, xs: ports.map((_, i) => startX + i * slotWidth) }
}
const FOUP_CENTER_Y = DOCK_Y + DOCK.height / 2 + FOUP.height / 2
const FOUP_Z = FRONT_Z + DOCK.protrude - 0.04

// 행렬/색 합성 임시 객체(재사용 — per-instance alloc 회피).
const TMP_M = new THREE.Matrix4()
const TMP_Q = new THREE.Quaternion()
const TMP_P = new THREE.Vector3()
const TMP_S = new THREE.Vector3()
const TMP_E = new THREE.Euler()
const TMP_C = new THREE.Color()

const bucket = (n: number) => Math.max(64, 2 ** Math.ceil(Math.log2(n + 1)))

function InstancedPart({
  geometry,
  material,
  instances,
  castShadow = false,
  receiveShadow = false,
  onPick,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  instances: PartInstance[]
  castShadow?: boolean
  receiveShadow?: boolean
  onPick?: (event: ThreeEvent<PointerEvent>) => void
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  // 버킷(2의 거듭제곱) 용량 — instances 길이가 버킷을 넘을 때만 remount(드묾). 평소엔 행렬만 갱신.
  const capacity = bucket(instances.length)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) {
      return
    }
    for (let i = 0; i < instances.length; i += 1) {
      const it = instances[i]
      TMP_E.set(0, it.ry, 0)
      TMP_Q.setFromEuler(TMP_E)
      TMP_P.set(it.px, it.py, it.pz)
      TMP_S.set(it.sx ?? 1, 1, 1)
      TMP_M.compose(TMP_P, TMP_Q, TMP_S)
      mesh.setMatrixAt(i, TMP_M)
      if (it.color) {
        mesh.setColorAt(i, TMP_C.set(it.color))
      }
    }
    mesh.count = instances.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  }, [instances])
  return (
    <instancedMesh
      key={capacity}
      ref={ref}
      args={[geometry, material, capacity]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled={false}
      onPointerDown={onPick}
    />
  )
}

export function LiveMap3DEquipmentField({
  placements,
  onPartPointerDown,
}: {
  placements: FieldPlacement[]
  onPartPointerDown: (localId: string, floorY: number, event: ThreeEvent<PointerEvent>) => void
}) {
  const single = (lx: number, ly: number, lz: number): PartInstance[] =>
    placements.map((p) => {
      const [px, py, pz] = place(p, lx, ly, lz)
      return { px, py, pz, ry: rad(p) }
    })

  const parts = useMemo(() => {
    const plinth = single(0, PLINTH_H / 2, 0)
    const mainframe = single(0, PLINTH_H + TOOL.mainframeH / 2, MAINFRAME_Z)
    const panel = single(0, PLINTH_H + TOOL.mainframeH * 0.55, MAINFRAME_Z + TOOL.mainframeD / 2 + 0.005)
    const efem = single(0, PLINTH_H + TOOL.efemH / 2, EFEM_Z)
    const glass = single(0, PLINTH_H + TOOL.efemH - 0.16, FRONT_Z + 0.005)
    const hub = single(0, MAINFRAME_TOP_Y + 0.15, MAINFRAME_Z)
    const towerPole = single(TOOL.width / 2 - 0.16, MAINFRAME_TOP_Y + 0.1, MAINFRAME_Z + TOOL.mainframeD / 2 - 0.14)
    const accent: PartInstance[] = placements.map((p) => {
      const [px, py, pz] = place(p, 0, PLINTH_H + TOOL.mainframeH - 0.16, MAINFRAME_Z + TOOL.mainframeD / 2 + 0.02)
      return { px, py, pz, ry: rad(p), color: p.status === 'RUN' ? LIVE_MAP_STATUS_COLOR.RUN : ACCENT_OFF }
    })
    const module: PartInstance[] = []
    const lid: PartInstance[] = []
    const towerSeg: PartInstance[] = []
    const dock: PartInstance[] = []
    const foup: PartInstance[] = []
    const band: PartInstance[] = []
    for (const p of placements) {
      for (const [mx, mz] of MODULES) {
        const [px, py, pz] = place(p, mx, MAINFRAME_TOP_Y + 0.17, MAINFRAME_Z + mz)
        module.push({ px, py, pz, ry: rad(p) })
        const [lx, ly, lz] = place(p, mx, MAINFRAME_TOP_Y + 0.35, MAINFRAME_Z + mz)
        lid.push({ px: lx, py: ly, pz: lz, ry: rad(p) })
      }
      const on = towerOn(p.status)
      for (let i = 0; i < 3; i += 1) {
        const [px, py, pz] = place(p, TOOL.width / 2 - 0.16, MAINFRAME_TOP_Y + 0.23 + i * 0.15, MAINFRAME_Z + TOOL.mainframeD / 2 - 0.14)
        towerSeg.push({ px, py, pz, ry: rad(p), color: on[i] ? TOWER_COLORS[i] : TOWER_OFF })
      }
      const { foupWidth, xs } = portLayout(p.ports)
      xs.forEach((x, i) => {
        const [dx, dy, dz] = place(p, x, DOCK_Y, FRONT_Z + DOCK.protrude / 2)
        dock.push({ px: dx, py: dy, pz: dz, ry: rad(p), sx: foupWidth + 0.1 })
        const [fx, fy, fz] = place(p, x, FOUP_CENTER_Y, FOUP_Z)
        foup.push({ px: fx, py: fy, pz: fz, ry: rad(p), sx: foupWidth })
        const [bx, by, bz] = place(p, x, FOUP_CENTER_Y + FOUP.height * 0.22, FOUP_Z + FOUP.depth / 2 + 0.025)
        band.push({ px: bx, py: by, pz: bz, ry: rad(p), sx: foupWidth * 0.62, color: LIVE_MAP_PORT_COLOR[p.ports[i].status] })
      })
    }
    return { plinth, mainframe, panel, efem, glass, hub, towerPole, accent, module, lid, towerSeg, dock, foup, band }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements])

  // 본체(mainframe) 클릭 → instanceId(=placement index) 로 매핑해 선택/드래그.
  const pickMainframe = (event: ThreeEvent<PointerEvent>) => {
    const id = event.instanceId
    if (id == null) {
      return
    }
    const p = placements[id]
    if (p) {
      onPartPointerDown(p.localId, p.floorY, event)
    }
  }

  return (
    <>
      <InstancedPart geometry={GEO.plinth} material={MAT.plinth} instances={parts.plinth} receiveShadow />
      <InstancedPart geometry={GEO.mainframe} material={MAT.body} instances={parts.mainframe} castShadow receiveShadow onPick={pickMainframe} />
      <InstancedPart geometry={GEO.panel} material={MAT.panel} instances={parts.panel} />
      <InstancedPart geometry={GEO.efem} material={MAT.efem} instances={parts.efem} castShadow receiveShadow />
      <InstancedPart geometry={GEO.glass} material={MAT.glass} instances={parts.glass} />
      <InstancedPart geometry={GEO.hub} material={MAT.hub} instances={parts.hub} />
      <InstancedPart geometry={GEO.module} material={MAT.chamber} instances={parts.module} />
      <InstancedPart geometry={GEO.lid} material={MAT.chamberLid} instances={parts.lid} />
      <InstancedPart geometry={GEO.towerPole} material={MAT.towerPole} instances={parts.towerPole} />
      <InstancedPart geometry={GEO.accent} material={MAT.accent} instances={parts.accent} />
      <InstancedPart geometry={GEO.towerSeg} material={MAT.tower} instances={parts.towerSeg} />
      <InstancedPart geometry={GEO.dock} material={MAT.dock} instances={parts.dock} receiveShadow />
      <InstancedPart geometry={GEO.foup} material={MAT.foup} instances={parts.foup} />
      <InstancedPart geometry={GEO.band} material={MAT.band} instances={parts.band} />
    </>
  )
}
