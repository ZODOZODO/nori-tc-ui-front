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

// 모던 클린 툴: 키 큰 흰색 본체(mainframe) + 키 큰 EFEM 전면 모듈 + 상단 FFU 캡 + 슬림 시그널타워.
const TOOL = { width: 2.0, mainframeH: 2.45, mainframeD: 1.1, efemH: 2.1, efemD: 0.64 }
const PLINTH_H = 0.08
const TOTAL_D = TOOL.mainframeD + TOOL.efemD
const FRONT_Z = TOTAL_D / 2
const MAINFRAME_Z = FRONT_Z - TOOL.efemD - TOOL.mainframeD / 2
const EFEM_Z = FRONT_Z - TOOL.efemD / 2
const MAINFRAME_TOP_Y = PLINTH_H + TOOL.mainframeH
const FOUP = { width: 0.42, height: 0.5, depth: 0.42 }
/** 로드포트(carrier 입구) 높이 — EFEM 전면 하부, OHT/작업자가 FOUP 을 적재하는 높이(바닥이 아님). */
const PORT_Y = PLINTH_H + 0.98
const DOCK = { height: 0.06, protrude: 0.2 }

const COLOR = {
  body: '#eef1f5', efem: '#e3e8ef', cap: '#f5f7fa', screen: '#1e2733',
  port: '#b8c2cf', foup: '#cdd5df', plinth: '#3a4250',
}

// 부품 종류당 1회 생성 공유 지오메트리(설비 수와 무관). 포트(dock/foup/band)는 단위 폭 1 → per-instance scale.x.
const GEO = {
  plinth: new THREE.BoxGeometry(TOOL.width + 0.06, PLINTH_H, TOTAL_D + 0.06),
  mainframe: new RoundedBoxGeometry(TOOL.width, TOOL.mainframeH, TOOL.mainframeD, 3, 0.06),
  cap: new THREE.BoxGeometry(TOOL.width + 0.04, 0.16, TOOL.mainframeD + 0.04),
  efem: new RoundedBoxGeometry(TOOL.width, TOOL.efemH, TOOL.efemD, 3, 0.05),
  screen: new THREE.BoxGeometry(TOOL.width * 0.42, 0.6, 0.02),
  accent: new THREE.BoxGeometry(TOOL.width * 0.9, 0.05, 0.02),
  towerPole: new THREE.CylinderGeometry(0.03, 0.04, 0.22, 10),
  towerSeg: new THREE.CylinderGeometry(0.07, 0.07, 0.12, 14),
  dock: new THREE.BoxGeometry(1, DOCK.height, DOCK.protrude),
  foup: new RoundedBoxGeometry(1, FOUP.height, FOUP.depth, 2, 0.04),
  band: new THREE.BoxGeometry(1, 0.06, 0.02),
}
const fixedMat = (color: string, metalness: number, roughness: number) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness })
const tintMat = (metalness: number, roughness: number) =>
  new THREE.MeshStandardMaterial({ color: '#ffffff', metalness, roughness })
const MAT = {
  plinth: fixedMat(COLOR.plinth, 0.4, 0.5),
  body: fixedMat(COLOR.body, 0.16, 0.36),
  cap: fixedMat(COLOR.cap, 0.14, 0.4),
  efem: fixedMat(COLOR.efem, 0.16, 0.38),
  screen: new THREE.MeshStandardMaterial({ color: COLOR.screen, emissive: new THREE.Color('#0e3a4a'), emissiveIntensity: 0.32, toneMapped: false, metalness: 0.2, roughness: 0.3 }),
  towerPole: fixedMat(COLOR.plinth, 0.5, 0.4),
  accent: tintMat(0.3, 0.5),
  tower: tintMat(0.4, 0.4),
  dock: fixedMat(COLOR.port, 0.4, 0.45),
  foup: fixedMat(COLOR.foup, 0.16, 0.5),
  band: tintMat(0.2, 0.5),
}

const ACCENT_OFF = '#aeb6c0'
const TOWER_OFF = '#1b2026'
// 점등 색은 뷰어(2D) 상태 색과 동일 — RUN 녹 / IDLE 청 / ERROR 적 (오해 방지 위해 안돈 황색 관례 대신 통일).
const TOWER_COLORS = [LIVE_MAP_STATUS_COLOR.ERROR, LIVE_MAP_STATUS_COLOR.IDLE, LIVE_MAP_STATUS_COLOR.RUN] as const
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
const FOUP_CENTER_Y = PORT_Y
const FOUP_Z = FRONT_Z + FOUP.depth / 2 - 0.06

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
    const cap = single(0, MAINFRAME_TOP_Y + 0.08, MAINFRAME_Z)
    const efem = single(0, PLINTH_H + TOOL.efemH / 2, EFEM_Z)
    // EFEM 전면 상부 터치 스크린(운영 패널).
    const screen = single(0, PLINTH_H + TOOL.efemH * 0.72, FRONT_Z + 0.012)
    const towerPole = single(TOOL.width / 2 - 0.2, MAINFRAME_TOP_Y + 0.16, MAINFRAME_Z)
    // 상태 LED 스트립 — EFEM 전면 상단(RUN 이면 녹색, 그 외 옅은 회색).
    const accent: PartInstance[] = placements.map((p) => {
      const [px, py, pz] = place(p, 0, PLINTH_H + TOOL.efemH - 0.14, FRONT_Z + 0.012)
      return { px, py, pz, ry: rad(p), color: p.status === 'RUN' ? LIVE_MAP_STATUS_COLOR.RUN : ACCENT_OFF }
    })
    const towerSeg: PartInstance[] = []
    const dock: PartInstance[] = []
    const foup: PartInstance[] = []
    const band: PartInstance[] = []
    for (const p of placements) {
      const on = towerOn(p.status)
      for (let i = 0; i < 3; i += 1) {
        const [px, py, pz] = place(p, TOOL.width / 2 - 0.2, MAINFRAME_TOP_Y + 0.34 + i * 0.12, MAINFRAME_Z)
        towerSeg.push({ px, py, pz, ry: rad(p), color: on[i] ? TOWER_COLORS[i] : TOWER_OFF })
      }
      const { foupWidth, xs } = portLayout(p.ports)
      xs.forEach((x, i) => {
        const [dx, dy, dz] = place(p, x, PORT_Y - FOUP.height / 2 - DOCK.height / 2, FRONT_Z + DOCK.protrude / 2)
        dock.push({ px: dx, py: dy, pz: dz, ry: rad(p), sx: foupWidth + 0.12 })
        const [fx, fy, fz] = place(p, x, FOUP_CENTER_Y, FOUP_Z)
        foup.push({ px: fx, py: fy, pz: fz, ry: rad(p), sx: foupWidth })
        const [bx, by, bz] = place(p, x, FOUP_CENTER_Y + FOUP.height * 0.2, FOUP_Z + FOUP.depth / 2 + 0.02)
        band.push({ px: bx, py: by, pz: bz, ry: rad(p), sx: foupWidth * 0.6, color: LIVE_MAP_PORT_COLOR[p.ports[i].status] })
      })
    }
    return { plinth, mainframe, cap, efem, screen, towerPole, accent, towerSeg, dock, foup, band }
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
      <InstancedPart geometry={GEO.cap} material={MAT.cap} instances={parts.cap} castShadow />
      <InstancedPart geometry={GEO.efem} material={MAT.efem} instances={parts.efem} castShadow receiveShadow />
      <InstancedPart geometry={GEO.screen} material={MAT.screen} instances={parts.screen} />
      <InstancedPart geometry={GEO.accent} material={MAT.accent} instances={parts.accent} />
      <InstancedPart geometry={GEO.towerPole} material={MAT.towerPole} instances={parts.towerPole} />
      <InstancedPart geometry={GEO.towerSeg} material={MAT.tower} instances={parts.towerSeg} />
      <InstancedPart geometry={GEO.dock} material={MAT.dock} instances={parts.dock} receiveShadow />
      <InstancedPart geometry={GEO.foup} material={MAT.foup} instances={parts.foup} castShadow />
      <InstancedPart geometry={GEO.band} material={MAT.band} instances={parts.band} />
    </>
  )
}
