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
 * 2개 층(1·2)만 사용해 층당 설비를 모아 라인을 길게 한다. 저장된 placement 는 자체 floor 를 가지므로 이 매핑은 자동 표시에만 적용된다.
 */
export const PROCESS_FLOOR: Record<string, number> = {
  photo: 1,
  etch: 1,
  cvd: 1,
  wet: 1,
  cmp: 2,
  diff: 2,
  imp: 2,
  metal: 2,
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

/** 드래그 스냅 격자 단위(px) — 씬 바닥 격자 1칸(cellSize=1 world)에 정합해 보이는 격자에 그대로 떨어진다. */
export const LIVE_MAP_SNAP_PX = LIVE_MAP_WORLD_SCALE

/** px 좌표를 스냅 격자에 반올림 — 드래그 이동 결과를 격자점에 떨어뜨린다(바둑판에 돌 놓듯). */
export const snapToGrid = (px: number): number => Math.round(px / LIVE_MAP_SNAP_PX) * LIVE_MAP_SNAP_PX

/**
 * 공정(cluster) 자동 레이아웃 — 실제 fab fishbone(스파인-베이) 플랜.
 *
 * <p>board 중앙을 가로지르는 <b>물류 스파인 통로</b>(가로)를 따라 각 공정(cluster)이 <b>직교 핑거 bay</b>로
 * 위/아래 번갈아(쌍을 이뤄 마주보게) 뻗어 나온다. bay 안 설비는 bay 내부 통로(세로)를 향해 <b>좌/우 2열</b>로
 * 마주보게 놓인다 — 로드포트가 내부 통로를 면하고, 통로는 스파인에 연결된다. bay 폭(가로)은 전 공정 동일하고
 * 설비가 많은 공정은 스파인 바깥쪽으로 길어진다(세로). 좌표는 board px — placementToWorld 로 world 변환되며
 * 드래그/저장 파이프라인과 동일 단위(편집 승격 시 그대로 이어짐).</p>
 */
/** 중앙 물류 스파인 통로 반폭(px) — 룸 중앙 통로(ROOM_AISLE_W=3.4 world)와 정합. bay 는 스파인 밖에서 시작. */
const SPINE_HALF_PX = 68
/** bay 중심 → 설비 열 중심(px). 두 열(좌/우) 사이가 내부 통로. */
const BAY_COL_OFFSET_PX = 78
/** bay 길이축(세로) 설비 줄 피치(px) — 설비 폭(2.0 world=80px) + 갭. */
const BAY_ROW_PITCH_PX = 92
/** bay 폭(가로 px) — 전 공정 동일(좌/우 2열 + 설비 깊이 여유). 길이만 설비 수로 가변. */
const BAY_WIDTH_PX = 236
/** 인접 bay 사이 서비스 chase 폭(px) — 파티션이 들어가는 공간. */
const BAY_GAP_PX = 60
/** bay 내부 통로 폭(px) — 씬이 통로 스트립 렌더에 사용(좌/우 열 사이). */
export const LIVE_MAP_BAY_AISLE_PX = 80

/** bay 길이축(세로) 설비 줄 수 — 좌/우 2열로 나눈 줄 개수(count 만으로 결정 → placed 무관 위치 안정성). */
const bayRows = (count: number): number => Math.max(1, Math.ceil(count / 2))
/** bay 길이(세로 px) — 줄 수 × 줄 피치. 설비 많은 공정일수록 스파인 바깥으로 길어진다. */
const bayLengthPx = (count: number): number => bayRows(count) * BAY_ROW_PITCH_PX

/** 공정 구간 1개 — board px 중심/크기. 구조물(구간 바닥존/컨베이어/라벨) 렌더와 설비 배치 공용. */
export interface LiveMapBay {
  clusterId: string
  clusterName: string
  floor: number
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
  depthPx: number
  /** 스파인 기준 핑거 방향 — −1 위(y 감소), +1 아래(y 증가). 설비 줄을 바깥으로 쌓는 부호. */
  side: 1 | -1
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

/**
 * 한 층의 cluster 그룹들을 fishbone 으로 배치한다. 두 공정이 한 슬롯(x)을 공유해 스파인 위/아래로 마주보는
 * 핑거 bay 를 이루고, 슬롯들은 board 중앙(스파인)을 기준으로 좌→우 등간격. bay 길이(세로)는 설비 수로 가변.
 */
const layoutFloorBays = (groups: readonly ClusterGroup[]): BayCell[] => {
  const slotCount = Math.max(1, Math.ceil(groups.length / 2))
  const totalWidth = slotCount * BAY_WIDTH_PX + (slotCount - 1) * BAY_GAP_PX
  const startX = LIVE_MAP_BOARD_PX_WIDTH / 2 - totalWidth / 2
  const spineY = LIVE_MAP_BOARD_PX_HEIGHT / 2
  return groups.map((group, index) => {
    const slot = Math.floor(index / 2)
    // 쌍의 첫(짝수) 공정은 스파인 위(−1, y 감소), 둘째(홀수)는 아래(+1, y 증가) — 마주보는 핑거.
    const side: 1 | -1 = index % 2 === 0 ? -1 : 1
    const centerXPx = startX + slot * (BAY_WIDTH_PX + BAY_GAP_PX) + BAY_WIDTH_PX / 2
    const lengthPx = bayLengthPx(group.eqpKeys.length)
    const centerYPx = spineY + side * (SPINE_HALF_PX + lengthPx / 2)
    return { group, centerXPx, centerYPx, widthPx: BAY_WIDTH_PX, depthPx: lengthPx, side }
  })
}

/** 라인 설비로부터 공정 구간 목록(구조물 렌더용) — 층별 컨베이어 라인 배치. */
export const buildLineBays = (equipments: readonly BayEquipmentInput[]): LiveMapBay[] => {
  const bays: LiveMapBay[] = []
  for (const [floor, floorGroups] of groupsByFloor(groupByCluster(equipments))) {
    for (const cell of layoutFloorBays(floorGroups)) {
      bays.push({
        clusterId: cell.group.clusterId,
        clusterName: cell.group.clusterName,
        floor,
        centerXPx: cell.centerXPx,
        centerYPx: cell.centerYPx,
        widthPx: cell.widthPx,
        depthPx: cell.depthPx,
      })
    }
  }
  return bays
}

/** 룸 바닥 최소 크기(world) — 설비 적은 라인 대응 하한(작게 잡아 룸이 설비에 딱 붙어 꽉 차 보이게). */
export const LIVE_MAP_ROOM_MIN_WIDTH = 20
export const LIVE_MAP_ROOM_MIN_DEPTH = 7
/** 설비 행 바깥 가장자리와 룸 외벽 사이 여백(px) — 설비를 외벽에 거의 붙이고 통로만 중앙에 남긴다(실 라인처럼 벽-투-벽). */
const ROOM_MARGIN_PX = 24

/**
 * 모든 공정 구간을 감싸는 룸 바닥 크기(world). 라인이 여러 컨베이어 줄로 접히면(wrap) 세로로 길어지므로 룸이 고정이면
 * 설비가 바닥/외벽 밖으로 floating 한다 — board 중앙(원점) 대칭으로 최대 반범위×2 + 여백을 덮어 모든 설비가 바닥 위에
 * 놓이게 한다. 전 층 동일 크기로 적층 정합. 빈 입력은 최소치.
 */
export const liveMapRoomSizeWorld = (bays: readonly LiveMapBay[]): { width: number; depth: number } => {
  let halfWidthPx = 0
  let halfDepthPx = 0
  for (const bay of bays) {
    halfWidthPx = Math.max(halfWidthPx, Math.abs(bay.centerXPx - LIVE_MAP_BOARD_PX_WIDTH / 2) + bay.widthPx / 2)
    halfDepthPx = Math.max(halfDepthPx, Math.abs(bay.centerYPx - LIVE_MAP_BOARD_PX_HEIGHT / 2) + bay.depthPx / 2)
  }
  return {
    width: Math.max(LIVE_MAP_ROOM_MIN_WIDTH, (2 * (halfWidthPx + ROOM_MARGIN_PX)) / LIVE_MAP_WORLD_SCALE),
    depth: Math.max(LIVE_MAP_ROOM_MIN_DEPTH, (2 * (halfDepthPx + ROOM_MARGIN_PX)) / LIVE_MAP_WORLD_SCALE),
  }
}

export interface AutoBayPlacement {
  eqpKey: number
  xPx: number
  yPx: number
  rotationDeg: number
  floor: number
}

/**
 * bay 안 설비 위치(px) + 회전 — bay 내부 통로(세로) 양쪽(좌/우) 2열로 마주본다. 같은 줄 인덱스가 좌(90°,+x 면)·
 * 우(270°,−x 면) 한 쌍을 이뤄 스파인에서 바깥으로 줄을 쌓는다 — 모든 로드포트가 내부 통로를 면한다.
 */
const equipmentSlot = (cell: BayCell, indexInCluster: number): { xPx: number; yPx: number; rotationDeg: number } => {
  const row = Math.floor(indexInCluster / 2)
  const isLeft = indexInCluster % 2 === 0
  const xPx = cell.centerXPx + (isLeft ? -BAY_COL_OFFSET_PX : BAY_COL_OFFSET_PX)
  // 스파인 가장자리에서 cell.side 방향(위 −/아래 +)으로 줄을 바깥으로 쌓는다.
  const spineEdgeYPx = LIVE_MAP_BOARD_PX_HEIGHT / 2 + cell.side * SPINE_HALF_PX
  const yPx = spineEdgeYPx + cell.side * (row + 0.5) * BAY_ROW_PITCH_PX
  return { xPx, yPx, rotationDeg: isLeft ? 90 : 270 }
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
      cell.group.eqpKeys.forEach((eqpKey, indexInCluster) => {
        if (placed.has(eqpKey)) {
          return
        }
        const slot = equipmentSlot(cell, indexInCluster)
        placements.push({ eqpKey, xPx: slot.xPx, yPx: slot.yPx, rotationDeg: slot.rotationDeg, floor })
      })
    }
  }
  return placements
}
