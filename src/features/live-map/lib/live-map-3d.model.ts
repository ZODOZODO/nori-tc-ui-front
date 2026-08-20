/**
 * live-map 3D(등각) 객체의 순수 모델입니다.
 *
 * <p>객체(shape_json v2)는 기본 도형(box/cylinder/plane) 조합으로 정의된다. 빌더(객체 라이브러리)가
 * 이 스펙을 만들고, 뷰어 3D 씬이 three 메시로 렌더한다(SPEC: live-map-3d). React/three 비의존 — 순수 TS.</p>
 *
 * <p>캔버스 색이 CSS 토큰이 아니라 hex 인 이유 — three 의 {@code Color.setStyle} 은 hex / rgb() / hsl() /
 * 색이름만 파싱한다(three 0.184.0 {@code Color.js:286}). ui-front 테마 토큰(src/index.css)은 전부
 * {@code oklch(...)} 이고 {@code var(--x)} 도 WebGL 에 전달할 수 없다 → 3D 캔버스 색은 이 모듈이 단일
 * 출처로 hex 를 들고 있고, DOM 오버레이(뱃지 / 칩)는 {@code live-map-status-theme.ts} 의 Tailwind
 * semantic 토큰을 쓴다.</p>
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

/** 포트 상태 → 색(hex). 3D 포트 도어 밴드 — 2D 뷰어 포트 색과 동일하게 설비 상태 색을 그대로 쓴다. */
export const LIVE_MAP_PORT_COLOR: Record<'RUN' | 'IDLE' | 'DOWN', string> = {
  RUN: LIVE_MAP_STATUS_COLOR.RUN,
  IDLE: LIVE_MAP_STATUS_COLOR.IDLE,
  DOWN: LIVE_MAP_STATUS_COLOR.DOWN,
}

/** 3D 씬 배경/바닥/그리드/조명 — 테마별 1세트. */
export interface LiveMapScenePalette {
  background: string
  ground: string
  gridCell: string
  gridSection: string
  hemiSky: string
  hemiGround: string
  ambient: number
  hemi: number
  badgeBg: string
}

/** 3D 뷰어 씬 색의 단일 출처. 빌더(객체 편집) 미리보기도 dark 세트의 배경을 그대로 쓴다. */
export const LIVE_MAP_SCENE_PALETTE: Record<'light' | 'dark', LiveMapScenePalette> = {
  dark: { background: '#0e1422', ground: '#0b1020', gridCell: '#1e2638', gridSection: '#3a4a63', hemiSky: '#cbd5e1', hemiGround: '#0b0f1a', ambient: 0.45, hemi: 0.45, badgeBg: 'rgba(11,16,32,0.92)' },
  light: { background: '#eef2f7', ground: '#dce3ed', gridCell: '#cdd6e2', gridSection: '#9aabbf', hemiSky: '#ffffff', hemiGround: '#c2ccd8', ambient: 0.72, hemi: 0.6, badgeBg: 'rgba(255,255,255,0.95)' },
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
 * 빌트인(기성) 구조물 — DB row 없이 편집기/뷰어 목록(구조물 편집)에 항상 노출되는 기본 구조물(벽/파티션/바닥/기둥).
 * 뷰어에 배치 후 저장 시 같은 이름의 STRUCTURE 객체를 1회 영속(지연저장)하고 placement 키를 치환한다.
 * objectKey 는 음수 sentinel — 양수 DB 키 및 설비 자동표시(0)와 충돌하지 않는다. 길이축은 X 고정(세로벽은 배치에서 90° 회전).
 */
export interface LiveMapBuiltinStructure {
  objectKey: number
  slug: string
  objectName: string
  shapeJson: LiveMap3DShape
}

/**
 * 구조물(벽/파티션/바닥/기둥)의 모던·클린 색 — 설비 팔레트(밝은 쿨그레이)와 정합.
 * 빌트인 템플릿과 렌더 오버라이드({@link LIVE_MAP_STRUCTURE_COLOR_BY_NAME})가 같은 값을 쓰도록 단일 출처로 둔다.
 */
const STRUCTURE_COLOR = {
  wall: '#dde2e9',
  partition: '#cbd2db',
  floor: '#d2d8e0',
  column: '#9aa3b2',
} as const

export const LIVE_MAP_BUILTIN_STRUCTURES: readonly LiveMapBuiltinStructure[] = [
  {
    objectKey: -1,
    slug: 'wall',
    objectName: '벽',
    shapeJson: { v: 2, prims: [{ id: 'wall', type: 'box', size: { x: 10, y: 3, z: 0.3 }, position: { x: 0, y: 1.5, z: 0 }, rotationY: 0, color: STRUCTURE_COLOR.wall }] },
  },
  {
    objectKey: -2,
    slug: 'partition',
    objectName: '파티션',
    shapeJson: { v: 2, prims: [{ id: 'partition', type: 'box', size: { x: 5, y: 1.6, z: 0.15 }, position: { x: 0, y: 0.8, z: 0 }, rotationY: 0, color: STRUCTURE_COLOR.partition }] },
  },
  {
    objectKey: -3,
    slug: 'floor',
    objectName: '바닥',
    shapeJson: { v: 2, prims: [{ id: 'floor', type: 'box', size: { x: 10, y: 0.2, z: 10 }, position: { x: 0, y: 0.1, z: 0 }, rotationY: 0, color: STRUCTURE_COLOR.floor }] },
  },
  {
    objectKey: -4,
    slug: 'column',
    objectName: '기둥',
    shapeJson: { v: 2, prims: [{ id: 'column', type: 'box', size: { x: 0.8, y: 3.5, z: 0.8 }, position: { x: 0, y: 1.75, z: 0 }, rotationY: 0, color: STRUCTURE_COLOR.column }] },
  },
]

/**
 * 구조물 objectName → 색. 색 출처는 "구조물 편집" 빌트인 객체({@link LIVE_MAP_BUILTIN_STRUCTURES})에서 직접 가져온다
 * (별도 하드코딩 아님 — 빌트인이 단일 출처). 이미 저장된 STRUCTURE 객체(예전 색이 shapeJson 에 박힘)도 뷰어/빌더
 * 렌더 시 이 색으로 오버라이드해, 빌트인 변경만으로 안 바뀌는 기존 저장분까지 일관된 모던 룩을 갖게 한다.
 */
export const LIVE_MAP_STRUCTURE_COLOR_BY_NAME: Readonly<Record<string, string>> = Object.fromEntries(
  LIVE_MAP_BUILTIN_STRUCTURES.map((builtin) => [builtin.objectName, builtin.shapeJson.prims[0]?.color]).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  ),
)

/** 빌트인 구조물 키(음수 sentinel)인지 — 저장 시 실 STRUCTURE 객체 키로 치환 대상. */
export const isBuiltinStructureKey = (objectKey: number): boolean => objectKey < 0

/** 뷰어 board 좌표계(2400×1500 px = 60×37.5 world). placement.transform.x/y 가 이 평면 위 위치. 설비 50+대를 펼칠 fab 규모. */
export const LIVE_MAP_BOARD_PX_WIDTH = 2400
export const LIVE_MAP_BOARD_PX_HEIGHT = 1500

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

/** 기본 구조 시드 1칸의 배치(빌트인 구조물 objectKey + px 위치/회전). 층은 호출부가 정한다. */
export interface DefaultStructurePlacement {
  objectKey: number
  xPx: number
  yPx: number
  rotationDeg: number
}

const builtinKeyBySlug = (slug: string): number => {
  const builtin = LIVE_MAP_BUILTIN_STRUCTURES.find((item) => item.slug === slug)
  if (builtin === undefined) {
    // slug 리터럴 오타 — 조용히 NaN 키로 진행하지 않도록 즉시 드러낸다.
    throw new Error(`unknown builtin structure slug: ${slug}`)
  }
  return builtin.objectKey
}

/**
 * 빈 레이아웃의 시작점 — 실제 반도체 fab 클린룸의 bay-and-chase 배치를 따른 시작 프레임.
 *
 * <p>fab 라인 배치 원칙(웹 리서치 기반): 설비는 도크월(bay/chase 경계벽)에 직선으로 줄지어 도킹하고(전면 load port = bay/통로,
 * 후면 정비부 = chase), 웨이퍼는 중앙 메인 통로(spine)에서 각 bay 로 분기 이송된다(OHT 는 직선 경로 필요). 따라서 사람/이송이
 * 다닐 통로가 필수다 — 이 시드는 ① raised floor 슬래브 ② 컷어웨이 외벽(후면·좌측) ③ 일정 간격 구조 기둥 격자 ④ 낮은 bay 도크월
 * 을 깔되, <b>중앙 spine 메인통로</b>(세로)와 <b>외벽쪽 perimeter 통로</b>를 비워 둔다(파티션을 그 폭만큼 끊는다). 실제 라인 치수는
 * 미상이라 "느낌" 수준의 시작 프레임이고, 모든 항목은 placement(빌트인 음수 키)라 드래그/삭제로 조정 + 저장 시 실 STRUCTURE 치환.</p>
 */
export const buildDefaultStructureLayout = (): DefaultStructurePlacement[] => {
  const wall = builtinKeyBySlug('wall')
  const partition = builtinKeyBySlug('partition')
  const floor = builtinKeyBySlug('floor')
  const column = builtinKeyBySlug('column')
  const s = LIVE_MAP_WORLD_SCALE
  const cx = LIVE_MAP_BOARD_PX_WIDTH / 2
  const cy = LIVE_MAP_BOARD_PX_HEIGHT / 2
  const tile = s * 10 // 바닥/벽 1칸 = 10 world = 400px
  const cols = 4
  const rows = 3
  const tileX = (c: number) => cx + (c - (cols - 1) / 2) * tile
  const tileZ = (r: number) => cy + (r - (rows - 1) / 2) * tile
  const minX = tileX(0) - tile / 2 // 좌측 외벽선
  const maxX = tileX(cols - 1) + tile / 2
  const minZ = tileZ(0) - tile / 2 // 후면 외벽선

  const placements: DefaultStructurePlacement[] = []

  // ① raised floor 슬래브 격자.
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      placements.push({ objectKey: floor, xPx: tileX(c), yPx: tileZ(r), rotationDeg: 0 })
    }
  }

  // ② 컷어웨이 외벽 — 등각 카메라 뒤쪽 2면(후면 minZ, 좌측 minX)만. 근접면 생략(내부 가시).
  for (let c = 0; c < cols; c += 1) {
    placements.push({ objectKey: wall, xPx: tileX(c), yPx: minZ, rotationDeg: 0 })
  }
  for (let r = 0; r < rows; r += 1) {
    placements.push({ objectKey: wall, xPx: minX, yPx: tileZ(r), rotationDeg: 90 })
  }

  // ③ 구조 기둥 격자(cols×rows) — 일정 간격(AMHS/구조 제약).
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      placements.push({ objectKey: column, xPx: tileX(c), yPx: tileZ(r), rotationDeg: 0 })
    }
  }

  // ④ 공정 bay 도크월(낮은 파티션) — 설비가 줄지어 도킹할 벽. 통로 확보를 위해 중앙 spine·외벽쪽 perimeter 폭만큼 끊는다.
  const partLen = s * 5 // 파티션 1칸 = 5 world = 200px
  const spineHalf = s * 3 // 중앙 메인통로 반폭 3 world → 통로 6 world(240px): OHT/사람 이동
  const perim = s * 4 // 외벽~bay 도크월 통로 = 4 world(160px)
  const fillRow = (z: number, from: number, to: number) => {
    const n = Math.max(0, Math.floor((to - from) / partLen))
    const start = from + (to - from - n * partLen) / 2 + partLen / 2
    for (let i = 0; i < n; i += 1) {
      placements.push({ objectKey: partition, xPx: start + i * partLen, yPx: z, rotationDeg: 0 })
    }
  }
  // bay 도크월 2줄(타일 행 경계) — spine(중앙) 양쪽으로 끊어 통로를 남긴다.
  for (const z of [tileZ(0) + tile / 2, tileZ(1) + tile / 2]) {
    fillRow(z, minX + perim, cx - spineHalf)
    fillRow(z, cx + spineHalf, maxX - perim)
  }

  return placements
}

/** 자동 배치 결과 1건 — 설비(eqpKey)를 어느 층 어느 px 좌표에 어느 방향(deg)으로 놓을지. */
export interface EquipmentAutoPlacement {
  eqpKey: number
  floor: number
  xPx: number
  yPx: number
  rotationDeg: number
}

/** fab 라인(fishbone bay) 자동 배치 기하. 좌/우 bay 블록(중앙 spine 통로는 비움), bay(lane)는 Z 로 내려간다. */
export interface FabLineLayoutParams {
  /** 설비가 채워지는 좌·우 bay 블록의 X 범위(px). 두 블록 사이(중앙 spine 세로 통로)는 비운다. */
  blocksX: ReadonlyArray<{ startPx: number; endPx: number }>
  /** 첫 bay 줄(lane)의 Z(px). */
  laneStartZPx: number
  /** bay 줄 간 Z 간격(px) — 줄 사이 통로 포함(설비 간격보다 넓게 둬 "줄"이 드러난다). */
  lanePitchPx: number
  /** bay 줄 안 설비 간 X 간격(px) — 촘촘히(도킹된 라인 느낌). */
  eqpPitchPx: number
}

/**
 * fab 라인 자동 배치 기하 — {@link buildDefaultStructureLayout} 의 룸 치수와 정합(중앙 spine·perimeter 통로 위치 동일).
 *
 * <p>좌/우 bay 블록은 [minX+perim, cx-spineHalf] = [560,1080] 과 [cx+spineHalf, maxX-perim] = [1320,1840]
 * (s=40, cx=1200, minX=400, maxX=2000, perim=160, spineHalf=120). 설비는 도크월을 따라 가로 줄로 도킹하고
 * 중앙 spine(1080~1320)은 OHT/사람 통로로 비운다. 줄(lane)은 Z 로 내려가며 줄 사이에 통로를 둔다.</p>
 */
export const LIVE_MAP_FAB_LINE_LAYOUT: FabLineLayoutParams = {
  blocksX: [
    { startPx: 560, endPx: 1080 },
    { startPx: 1320, endPx: 1840 },
  ],
  // 줄(lane)은 도크월(z≈550, 950)을 끼고 깔리도록 z=450 부터 200 간격(450·650·850·1050…) — bay 에 도킹된 느낌.
  laneStartZPx: 450,
  lanePitchPx: 200,
  eqpPitchPx: 104,
}

/** bay 블록들을 X 슬롯 좌표 배열로 — 블록 순서대로(좌 → 우), 각 블록은 start 부터 eqpPitch 간격으로 end 까지. */
const buildLineSlotXs = (blocksX: FabLineLayoutParams['blocksX'], eqpPitchPx: number): number[] => {
  const slotXs: number[] = []
  for (const block of blocksX) {
    for (let x = block.startPx; x <= block.endPx + 0.001; x += eqpPitchPx) {
      slotXs.push(x)
    }
  }
  return slotXs
}

/**
 * 미배치 설비를 gateway_app 기준 층(floorByEqpKey)에 fab 라인(fishbone bay) 형태로 자동 배치한다(순수).
 *
 * <p>층마다 좌/우 bay 블록을 가로 줄로 채우고(중앙 spine 통로는 비움), 한 줄이 차면 다음 줄(Z+lanePitch)로 내려간다.
 * 줄(lane)은 짝/홀로 0°/180° 를 번갈아 향해, 이웃한 두 줄이 로드포트(전면)를 마주보는 통로(bay)와 등을 맞댄 chase 가
 * 번갈아 생긴다(반도체 fab 의 bay-and-chase). 입력 순서를 보존하므로, 호출부가 clusterId 순으로 정렬해 넘기면 같은
 * 클러스터가 한 bay 에 모여 보인다. floorByEqpKey 에 매핑이 없는 설비는 fallbackFloor 로 보내 누락을 막는다.</p>
 */
export const planEquipmentLineLayout = (
  orderedEqpKeys: readonly number[],
  floorByEqpKey: ReadonlyMap<number, number>,
  fallbackFloor: number,
  params: FabLineLayoutParams,
): EquipmentAutoPlacement[] => {
  const slotXs = buildLineSlotXs(params.blocksX, params.eqpPitchPx)
  const eqpKeysByFloor = new Map<number, number[]>()
  for (const eqpKey of orderedEqpKeys) {
    const floor = floorByEqpKey.get(eqpKey) ?? fallbackFloor
    const bucket = eqpKeysByFloor.get(floor) ?? []
    bucket.push(eqpKey)
    eqpKeysByFloor.set(floor, bucket)
  }

  const placements: EquipmentAutoPlacement[] = []
  for (const [floor, eqpKeys] of eqpKeysByFloor) {
    eqpKeys.forEach((eqpKey, index) => {
      const lane = Math.floor(index / slotXs.length)
      placements.push({
        eqpKey,
        floor,
        xPx: slotXs[index % slotXs.length],
        yPx: params.laneStartZPx + lane * params.lanePitchPx,
        // 짝수 줄 180° / 홀수 줄 0° — 설비 등(back)이 도크월(파티션) 쪽을 향해 chase 를 이루고, 전면(로드포트)은
        // 통로 쪽으로 열려 사람/OHT 가 다닐 수 있다. 이웃 줄은 전면끼리 마주보는 통로 + 등끼리 맞댄 chase 가 번갈아.
        rotationDeg: lane % 2 === 0 ? 180 : 0,
      })
    })
  }
  return placements
}

/** 객체(shape) 의 로컬 축정렬 bounding box(중심/크기) — 선택 표시 박스를 객체 크기에 맞춰 그릴 때 쓴다(순수). */
export const shapeBoundingBox = (shape: LiveMap3DShape): { center: Vec3; size: Vec3 } => {
  if (shape.prims.length === 0) {
    return { center: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } }
  }
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (const prim of shape.prims) {
    const hx = prim.size.x / 2
    const hy = prim.size.y / 2
    // cylinder/plane 도 size.x 를 폭(지름)으로 쓰므로 size 절반으로 근사한다(빌트인은 box 라 정확).
    const hz = prim.size.z / 2
    minX = Math.min(minX, prim.position.x - hx)
    maxX = Math.max(maxX, prim.position.x + hx)
    minY = Math.min(minY, prim.position.y - hy)
    maxY = Math.max(maxY, prim.position.y + hy)
    minZ = Math.min(minZ, prim.position.z - hz)
    maxZ = Math.max(maxZ, prim.position.z + hz)
  }
  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  }
}
