/**
 * live-map 3D(등각) 객체의 순수 모델입니다.
 *
 * <p>객체(shape_json v2)는 기본 도형(box/cylinder/plane) 조합으로 정의된다. 빌더(객체 라이브러리)가
 * 이 스펙을 만들고, 뷰어 3D 씬이 three 메시로 렌더한다(SPEC: live-map-3d). React/three 비의존 — 순수 TS.</p>
 */

export type LiveMap3DPrimType = 'box' | 'cylinder' | 'plane'

export interface Vec3 {
  x: number
  y: number
  z: number
}

/** 기본 도형 1개 — 크기/위치(객체 로컬, world unit)/Y축 회전(rad)/색. */
export interface LiveMap3DPrim {
  id: string
  type: LiveMap3DPrimType
  size: Vec3
  position: Vec3
  rotationY: number
  color: string
}

/** tc_live_map_object.shape_json v2 — 3D 도형 조합(JSONB, 스키마 변경 없이 기존 컬럼 재사용). */
export interface LiveMap3DShape {
  v: 2
  prims: LiveMap3DPrim[]
}

/** 설비 상태 → 색(hex). 상태 뱃지/3D 설비 모델 공용. */
export const LIVE_MAP_STATUS_COLOR: Record<'RUN' | 'IDLE' | 'ERROR' | 'DOWN', string> = {
  RUN: '#22c55e',
  IDLE: '#0ea5e9',
  ERROR: '#ef4444',
  DOWN: '#64748b',
}

/** 포트 상태 → 색(hex). 3D 포트 그리드 LED. */
export const LIVE_MAP_PORT_COLOR: Record<'RUN' | 'IDLE' | 'DOWN', string> = {
  RUN: '#22c55e',
  IDLE: '#f59e0b',
  DOWN: '#475569',
}

/** shape_json 이 v2(3D) 스펙인지 — v1(Konva Group)과 구분한다. */
export const isLiveMap3DShape = (json: unknown): json is LiveMap3DShape => {
  if (typeof json !== 'object' || json === null) {
    return false
  }
  const candidate = json as { v?: unknown; prims?: unknown }
  return candidate.v === 2 && Array.isArray(candidate.prims)
}

/**
 * 빌트인(기성) 구조물 — DB row 없이 편집기/뷰어 목록에 항상 노출되는 기본 구조물(벽/파티션).
 * 뷰어에 배치 후 저장 시 같은 이름의 STRUCTURE 객체를 1회 영속(지연저장)하고 placement 키를 치환한다.
 * objectKey 는 음수 sentinel — 양수 DB 키 및 설비 자동표시(0)와 충돌하지 않는다. 길이축은 X 고정(세로벽은 배치에서 90° 회전).
 */
export interface LiveMapBuiltinStructure {
  objectKey: number
  slug: string
  objectName: string
  shapeJson: LiveMap3DShape
}

export const LIVE_MAP_BUILTIN_STRUCTURES: readonly LiveMapBuiltinStructure[] = [
  {
    objectKey: -1,
    slug: 'wall',
    objectName: '벽',
    shapeJson: { v: 2, prims: [{ id: 'wall', type: 'box', size: { x: 10, y: 3, z: 0.3 }, position: { x: 0, y: 1.5, z: 0 }, rotationY: 0, color: '#94a3b8' }] },
  },
  {
    objectKey: -2,
    slug: 'partition',
    objectName: '파티션',
    shapeJson: { v: 2, prims: [{ id: 'partition', type: 'box', size: { x: 5, y: 1.6, z: 0.15 }, position: { x: 0, y: 0.8, z: 0 }, rotationY: 0, color: '#b8c2d0' }] },
  },
]

/** 빌트인 구조물 키(음수 sentinel)인지 — 저장 시 실 STRUCTURE 객체 키로 치환 대상. */
export const isBuiltinStructureKey = (objectKey: number): boolean => objectKey < 0

/**
 * 공정(클러스터)별 자동 표시 설비의 기본 층 — clusterId(소문자) 기준. 미지정 공정(metro/etc 등)은 1층.
 * 저장된 placement 는 자체 floor 를 가지므로 이 매핑은 자동 표시에만 적용된다.
 */
export const PROCESS_FLOOR: Record<string, number> = {
  photo: 1,
  etch: 1,
  cvd: 1,
  cmp: 2,
  diff: 2,
  imp: 2,
  wet: 3,
  metal: 3,
}

export const floorForCluster = (clusterId: string | null | undefined): number =>
  PROCESS_FLOOR[(clusterId ?? '').toLowerCase()] ?? 1

/** 뷰어 board 좌표계(1350×710 px). placement.transform.x/y 가 이 평면 위 위치. */
export const LIVE_MAP_BOARD_PX_WIDTH = 1350
export const LIVE_MAP_BOARD_PX_HEIGHT = 710

/** placement px 좌표를 3D world(중앙 원점)로 — y(px)→z(world). 1 world unit ≈ WORLD_SCALE px. */
export const LIVE_MAP_WORLD_SCALE = 40

export const placementToWorld = (xPx: number, yPx: number): [number, number] => [
  (xPx - LIVE_MAP_BOARD_PX_WIDTH / 2) / LIVE_MAP_WORLD_SCALE,
  (yPx - LIVE_MAP_BOARD_PX_HEIGHT / 2) / LIVE_MAP_WORLD_SCALE,
]

/** 3D world(바닥 x/z) → placement px 좌표(드래그 결과를 transform 에 반영). placementToWorld 의 역. */
export const worldToPlacement = (worldX: number, worldZ: number): [number, number] => [
  worldX * LIVE_MAP_WORLD_SCALE + LIVE_MAP_BOARD_PX_WIDTH / 2,
  worldZ * LIVE_MAP_WORLD_SCALE + LIVE_MAP_BOARD_PX_HEIGHT / 2,
]

/**
 * 공정(cluster) bay 자동 레이아웃 — 실제 fab 의 bay-and-chase 구조.
 *
 * <p>층마다 그 층의 공정들을 중앙 통로(가로) 양옆 2행 bay 로 배치하고(위 ceil(n/2)·아래 floor(n/2), 각 행 중앙정렬),
 * 각 bay 안에 설비를 통로 향해 3열 격자로 정렬(앞줄 = 통로 쪽, 로드포트가 통로를 향함). 좌표는 board px —
 * placementToWorld 로 world 변환되며 드래그/저장 파이프라인과 동일 단위(편집 승격 시 그대로 이어짐).</p>
 */
const BAY_DEPTH_PX = 240
const BAY_GAP_X_PX = 16
const BAY_MARGIN_X_PX = 30
const BAY_MARGIN_Z_PX = 50
const TOP_ROW_CENTER_Y_PX = BAY_MARGIN_Z_PX + BAY_DEPTH_PX / 2
const BOTTOM_ROW_CENTER_Y_PX = LIVE_MAP_BOARD_PX_HEIGHT - BAY_MARGIN_Z_PX - BAY_DEPTH_PX / 2

const BAY_EQ_CELL_W_PX = 90
const BAY_EQ_ROW_STRIDE_PX = 92
const BAY_EQ_FRONT_MARGIN_PX = 55

/** bay 1개 — board px 중심/크기 + 통로 기준 행(top/bottom). 구조물(바닥존/벽/라벨) 렌더와 설비 배치 공용. */
export interface LiveMapBay {
  clusterId: string
  clusterName: string
  floor: number
  row: 'top' | 'bottom'
  centerXPx: number
  centerYPx: number
  widthPx: number
  depthPx: number
}

/** 설비 그룹화 입력 — 라인 실설비에서 추린 최소 필드. */
export interface BayEquipmentInput {
  eqpKey: number
  clusterId: string
  clusterName: string
}

interface ClusterGroup {
  clusterId: string
  clusterName: string
  floor: number
  eqpKeys: number[]
}

interface BayCell {
  group: ClusterGroup
  centerXPx: number
  centerYPx: number
  widthPx: number
  row: 'top' | 'bottom'
}

/** 라인 설비를 등장 순서 보존하며 cluster 로 그룹화(+층). 위치 안정성의 기반 = 그룹/순서가 placed 와 무관. */
const groupByCluster = (equipments: readonly BayEquipmentInput[]): ClusterGroup[] => {
  const order: string[] = []
  const byId = new Map<string, ClusterGroup>()
  for (const equipment of equipments) {
    const existing = byId.get(equipment.clusterId)
    if (existing) {
      existing.eqpKeys.push(equipment.eqpKey)
      continue
    }
    byId.set(equipment.clusterId, {
      clusterId: equipment.clusterId,
      clusterName: equipment.clusterName,
      floor: floorForCluster(equipment.clusterId),
      eqpKeys: [equipment.eqpKey],
    })
    order.push(equipment.clusterId)
  }
  return order.map((id) => byId.get(id) as ClusterGroup)
}

const groupsByFloor = (groups: readonly ClusterGroup[]): Map<number, ClusterGroup[]> => {
  const byFloor = new Map<number, ClusterGroup[]>()
  for (const group of groups) {
    const list = byFloor.get(group.floor)
    if (list) {
      list.push(group)
    } else {
      byFloor.set(group.floor, [group])
    }
  }
  return byFloor
}

/** 한 층의 cluster 그룹들을 2행 bay 셀로 — 위 ceil(n/2)·아래 나머지. 각 행은 보드 폭을 꽉 채우게 등분(타일링). */
const layoutFloorBays = (groups: readonly ClusterGroup[]): BayCell[] => {
  const topCount = Math.ceil(groups.length / 2)
  const rows = [
    { items: groups.slice(0, topCount), centerYPx: TOP_ROW_CENTER_Y_PX, row: 'top' as const },
    { items: groups.slice(topCount), centerYPx: BOTTOM_ROW_CENTER_Y_PX, row: 'bottom' as const },
  ]
  const cells: BayCell[] = []
  for (const { items, centerYPx, row } of rows) {
    const count = items.length
    if (count === 0) {
      continue
    }
    const usableWidth = LIVE_MAP_BOARD_PX_WIDTH - 2 * BAY_MARGIN_X_PX
    const bayWidth = (usableWidth - (count - 1) * BAY_GAP_X_PX) / count
    items.forEach((group, index) => {
      const centerXPx = BAY_MARGIN_X_PX + index * (bayWidth + BAY_GAP_X_PX) + bayWidth / 2
      cells.push({ group, centerXPx, centerYPx, widthPx: bayWidth, row })
    })
  }
  return cells
}

/** 라인 설비로부터 공정 bay 목록(구조물 렌더용) — 층별 2행 배치. */
export const buildLineBays = (equipments: readonly BayEquipmentInput[]): LiveMapBay[] => {
  const bays: LiveMapBay[] = []
  for (const [floor, floorGroups] of groupsByFloor(groupByCluster(equipments))) {
    for (const cell of layoutFloorBays(floorGroups)) {
      bays.push({
        clusterId: cell.group.clusterId,
        clusterName: cell.group.clusterName,
        floor,
        row: cell.row,
        centerXPx: cell.centerXPx,
        centerYPx: cell.centerYPx,
        widthPx: cell.widthPx,
        depthPx: BAY_DEPTH_PX,
      })
    }
  }
  return bays
}

export interface AutoBayPlacement {
  eqpKey: number
  xPx: number
  yPx: number
  rotationDeg: number
  floor: number
}

/** bay 안 설비 위치(px) + 통로 향한 회전 — bay 폭에 맞춰 열 수를 정하고(촘촘히) 중앙정렬, 앞줄=통로 쪽. */
const equipmentSlot = (cell: BayCell, indexInCluster: number, count: number): { xPx: number; yPx: number; rotationDeg: number } => {
  const columns = Math.min(Math.max(Math.floor(cell.widthPx / BAY_EQ_CELL_W_PX), 1), count)
  const column = indexInCluster % columns
  const rowIndex = Math.floor(indexInCluster / columns)
  const gridWidth = (columns - 1) * BAY_EQ_CELL_W_PX
  const xPx = cell.centerXPx - gridWidth / 2 + column * BAY_EQ_CELL_W_PX
  if (cell.row === 'top') {
    // 통로는 +Y(px)/+Z(world) 쪽 — 앞줄이 통로에 붙고 로드포트(전면, +Z)가 통로를 향한다(회전 0).
    const frontYPx = cell.centerYPx + BAY_DEPTH_PX / 2 - BAY_EQ_FRONT_MARGIN_PX
    return { xPx, yPx: frontYPx - rowIndex * BAY_EQ_ROW_STRIDE_PX, rotationDeg: 0 }
  }
  // 아래 행 bay 는 통로가 -Y(px)/-Z(world) 쪽 — 180° 돌려 전면이 통로를 향한다.
  const frontYPx = cell.centerYPx - BAY_DEPTH_PX / 2 + BAY_EQ_FRONT_MARGIN_PX
  return { xPx, yPx: frontYPx + rowIndex * BAY_EQ_ROW_STRIDE_PX, rotationDeg: 180 }
}

/**
 * 미배치 설비의 bay 자동 배치(px + 회전 + 층). 위치는 <b>전체 라인 설비를 cluster 로 그룹화한 뒤 그룹 내 고정 index</b>
 * 로 계산 — 일부 설비를 편집(승격)으로 placed 에 넣어도 나머지 위치는 불변(placed 는 출력 필터에만 쓰이고 그룹/인덱스 불변).
 */
export const buildBayEquipmentPlacements = (
  equipments: readonly BayEquipmentInput[],
  placed: ReadonlySet<number>,
): AutoBayPlacement[] => {
  const placements: AutoBayPlacement[] = []
  for (const [floor, floorGroups] of groupsByFloor(groupByCluster(equipments))) {
    for (const cell of layoutFloorBays(floorGroups)) {
      const count = cell.group.eqpKeys.length
      cell.group.eqpKeys.forEach((eqpKey, indexInCluster) => {
        if (placed.has(eqpKey)) {
          return
        }
        const slot = equipmentSlot(cell, indexInCluster, count)
        placements.push({ eqpKey, xPx: slot.xPx, yPx: slot.yPx, rotationDeg: slot.rotationDeg, floor })
      })
    }
  }
  return placements
}
