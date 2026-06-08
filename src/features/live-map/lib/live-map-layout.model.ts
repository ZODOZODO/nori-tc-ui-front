/**
 * live-map 레이아웃 빌더(Phase 2)의 순수 직렬화/검증 모델입니다.
 *
 * <p>React / konva / zustand 에 의존하지 않는 순수 TS 입니다 — node:test(`tests/*.test.ts`)가
 * konva 캔버스 없이 직렬화·배치 로직을 직접 검증할 수 있도록 분리합니다(SPEC: 캔버스 인터랙션은 e2e).</p>
 *
 * <p>JSONB 키 스키마 동결안(SPEC 2026-06-02): 3 컬럼 모두 최상위 스키마 버전 {@code v} 래퍼,
 * shape_json = {v, root:<Konva Group toObject()>}, transform_json = skew 기반 의사 2.5D.</p>
 */

export const LIVE_MAP_SCHEMA_VERSION = 1

export type LiveMapObjectKind = 'STRUCTURE' | 'EQUIPMENT'

/** Konva node.toObject() 트리 1노드. 컨테이너만 children 을 가진다. */
export interface KonvaNode {
  className: string
  attrs: Record<string, unknown>
  children?: KonvaNode[]
}

/** tc_live_map_object.shape_json — 합성 객체 원형(Konva Group 직렬화 + v 래퍼). */
export interface ShapeJson {
  v: number
  root: KonvaNode
}

/** tc_live_map_placement.transform_json — skew 기반 의사 2.5D 배치 변환. */
export interface TransformJson {
  v: number
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
  zIndex: number
  depth: number
  /** 3D 뷰어 층(1~). 미지정 시 1층. 백엔드는 transform_json 을 opaque JSONB 로 보존(스키마 무변경). */
  floor?: number
}

export interface GridConfig {
  visible: boolean
  size: number
  color: string
}

/** tc_live_map_layout.canvas_json — 캔버스 메타(크기/배경/그리드). */
export interface CanvasJson {
  v: number
  width: number
  height: number
  background: string
  grid: GridConfig
}

/** 신규/빈 layout 의 프론트 기본 캔버스. */
export const DEFAULT_CANVAS_JSON: CanvasJson = {
  v: LIVE_MAP_SCHEMA_VERSION,
  width: 1920,
  height: 1080,
  background: '#0b0f1a',
  grid: { visible: true, size: 32, color: '#1e2638' },
}

const PRIMITIVE_WHITELIST = ['Rect', 'Line', 'Text', 'Image'] as const
export type PrimitiveClassName = (typeof PRIMITIVE_WHITELIST)[number]

export const isPrimitiveClassName = (name: string): name is PrimitiveClassName =>
  (PRIMITIVE_WHITELIST as readonly string[]).includes(name)

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 최상위 v(정수)가 존재하는지 확인(서버 PUT 검증과 동일 규칙의 프론트 사전검증). */
export const hasSchemaVersion = (json: unknown): boolean =>
  isPlainObject(json) && Number.isInteger((json as Record<string, unknown>).v)

/** primitive 노드 배열을 Konva Group toObject() 형태({v, root}) 로 감싼다. */
export const buildShapeJson = (
  rootAttrs: Record<string, unknown>,
  children: readonly KonvaNode[],
): ShapeJson => ({
  v: LIVE_MAP_SCHEMA_VERSION,
  root: {
    className: 'Group',
    attrs: { ...rootAttrs },
    children: children.map((child) => ({ ...child })),
  },
})

/** shape_json 의 v(정수) + root Group 구조를 검증한다. 위반 시 Error. */
export const validateShapeJson = (json: unknown): ShapeJson => {
  if (!isPlainObject(json)) {
    throw new Error('shapeJson must be an object')
  }
  if (!Number.isInteger(json.v)) {
    throw new Error('shapeJson.v must be an integer')
  }
  const root = json.root
  if (!isPlainObject(root)) {
    throw new Error('shapeJson.root must be an object')
  }
  if (root.className !== 'Group') {
    throw new Error('shapeJson.root.className must be "Group"')
  }
  return json as unknown as ShapeJson
}

/** 배치 변환 기본값 + 부분 override. */
export const buildTransformJson = (overrides: Partial<Omit<TransformJson, 'v'>>): TransformJson => ({
  v: LIVE_MAP_SCHEMA_VERSION,
  x: overrides.x ?? 0,
  y: overrides.y ?? 0,
  rotation: overrides.rotation ?? 0,
  scaleX: overrides.scaleX ?? 1,
  scaleY: overrides.scaleY ?? 1,
  skewX: overrides.skewX ?? 0,
  skewY: overrides.skewY ?? 0,
  zIndex: overrides.zIndex ?? 0,
  depth: overrides.depth ?? 0,
  floor: overrides.floor ?? 1,
})

/**
 * EQUIPMENT/STRUCTURE ↔ eqpKey 상호 배타(프론트 사전검증, 서버 검증과 동일 규칙).
 *
 * @returns 위반 시 사유 메시지, 정상이면 null
 */
export const validatePlacementEqpBinding = (
  objectKind: LiveMapObjectKind,
  eqpKey: number | null | undefined,
): string | null => {
  if (objectKind === 'EQUIPMENT') {
    return eqpKey == null ? 'EQUIPMENT placement requires an eqpKey.' : null
  }
  return eqpKey != null ? 'STRUCTURE placement must not have an eqpKey.' : null
}

export interface DepthSortable {
  depth: number
  zIndex: number
}

/** 2.5D painter 깊이 정렬: depth 오름차순, 동률이면 zIndex 오름차순. 입력 불변(새 배열). */
export const sortByDepth = <T extends DepthSortable>(items: readonly T[]): T[] =>
  [...items].sort((left, right) => left.depth - right.depth || left.zIndex - right.zIndex)

/** 배치 scale 허용 범위 — 0 / 음수 / 폭주 방지. */
export const MIN_PLACEMENT_SCALE = 0.2
export const MAX_PLACEMENT_SCALE = 5

/** scale 값을 [MIN, MAX] 로 제한한다. */
export const clampScale = (value: number): number =>
  Math.min(MAX_PLACEMENT_SCALE, Math.max(MIN_PLACEMENT_SCALE, value))

/** transform 의 scaleX/scaleY 에 factor 를 곱해 새 transform 을 만든다(범위 clamp). 입력 불변. */
export const scaleTransform = (transform: TransformJson, factor: number): TransformJson => ({
  ...transform,
  scaleX: clampScale(transform.scaleX * factor),
  scaleY: clampScale(transform.scaleY * factor),
})

/**
 * 다중선택 토글: additive 면 id 를 추가/제거, 아니면 단일 선택으로 교체.
 *
 * @returns 새 선택 id 배열(입력 불변)
 */
export const toggleSelection = (
  selected: readonly string[],
  id: string,
  additive: boolean,
): string[] => {
  if (!additive) {
    return [id]
  }
  return selected.includes(id) ? selected.filter((current) => current !== id) : [...selected, id]
}

/**
 * 선택 인덱스의 배치를 겹침 정렬 맨 앞으로 — depth/zIndex 를 현재 최대값 위로 올린다.
 * 비선택 항목은 불변. 입력 불변(새 배열).
 */
export const liftTransformsToFront = (
  transforms: readonly TransformJson[],
  selectedIndices: ReadonlySet<number>,
): TransformJson[] => {
  const maxDepth = transforms.reduce((max, transform) => Math.max(max, transform.depth), 0)
  const maxZIndex = transforms.reduce((max, transform) => Math.max(max, transform.zIndex), 0)
  let offset = 0
  return transforms.map((transform, index) => {
    if (!selectedIndices.has(index)) {
      return transform
    }
    offset += 1
    return { ...transform, depth: maxDepth + offset, zIndex: maxZIndex + offset }
  })
}

/**
 * 선택 인덱스의 배치를 겹침 정렬 맨 뒤로 — depth/zIndex 를 현재 최소값 아래로 내린다.
 * 비선택 항목은 불변. 입력 불변(새 배열).
 */
export const sinkTransformsToBack = (
  transforms: readonly TransformJson[],
  selectedIndices: ReadonlySet<number>,
): TransformJson[] => {
  const minDepth = transforms.reduce((min, transform) => Math.min(min, transform.depth), 0)
  const minZIndex = transforms.reduce((min, transform) => Math.min(min, transform.zIndex), 0)
  let offset = 0
  return transforms.map((transform, index) => {
    if (!selectedIndices.has(index)) {
      return transform
    }
    offset += 1
    return { ...transform, depth: minDepth - offset, zIndex: minZIndex - offset }
  })
}

/**
 * Image primitive 의 기본 src — 1x1 투명 PNG data URI.
 *
 * <p>네트워크 없이 즉시 로드되도록 data URI 를 기본값으로 둔다(저장된 객체의 실제 URL 은 그대로 렌더).
 * 바이너리 업로드/스토리지는 Out of Scope — `src` 는 URL 참조만.</p>
 */
export const DEFAULT_IMAGE_SRC =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
