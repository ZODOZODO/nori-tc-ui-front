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

/** 저장 배치가 없는 실설비를 바닥에 자동 배치할 때의 그리드 px 좌표(board 중앙 기준 정렬). */
const AUTO_GRID_COLUMNS = 6
const AUTO_GRID_GAP_X = 120
const AUTO_GRID_GAP_Z = 140
export const autoGridPx = (index: number, total: number): [number, number] => {
  const columns = Math.min(AUTO_GRID_COLUMNS, Math.max(total, 1))
  const rows = Math.ceil(Math.max(total, 1) / columns)
  const column = index % columns
  const row = Math.floor(index / columns)
  const gridWidth = (columns - 1) * AUTO_GRID_GAP_X
  const gridHeight = (rows - 1) * AUTO_GRID_GAP_Z
  return [
    LIVE_MAP_BOARD_PX_WIDTH / 2 - gridWidth / 2 + column * AUTO_GRID_GAP_X,
    LIVE_MAP_BOARD_PX_HEIGHT / 2 - gridHeight / 2 + row * AUTO_GRID_GAP_Z,
  ]
}

export interface AutoEquipmentPlacement {
  eqpKey: number
  xPx: number
  yPx: number
}

/**
 * 미배치 설비의 자동 그리드 위치(px) 목록. 위치는 <b>전체 라인 설비 리스트의 고정 index/총개수</b> 로 계산하므로,
 * 일부 설비를 배치(편집)로 placed 에 넣어도 나머지 자동 설비의 위치는 재배치되지 않는다(미배치 부분집합 기준이면
 * 승격 시 인덱스가 당겨져 다른 설비가 빈 자리로 이동·겹침).
 */
export const buildAutoEquipmentPlacements = (
  eqpKeys: readonly number[],
  placed: ReadonlySet<number>,
): AutoEquipmentPlacement[] =>
  eqpKeys
    .map((eqpKey, index) => ({ eqpKey, index }))
    .filter(({ eqpKey }) => !placed.has(eqpKey))
    .map(({ eqpKey, index }) => {
      const [xPx, yPx] = autoGridPx(index, eqpKeys.length)
      return { eqpKey, xPx, yPx }
    })
