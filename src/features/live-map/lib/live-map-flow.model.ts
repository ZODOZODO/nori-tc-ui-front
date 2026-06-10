import type { CanvasJson } from './live-map-layout.model.ts'
import { DEFAULT_CANVAS_JSON } from './live-map-layout.model.ts'

/**
 * 공정 흐름(2D board) 사용자 저작 모델 — 그룹 카드 + 설비 배정의 순수 직렬화/조작 로직입니다.
 *
 * <p>tc_live_map_layout.canvas_json(JSONB) 의 {@code flow} 키에 저장된다. 서버는 canvas_json 을
 * opaque 로 보존(최상위 v 만 검증)하므로 백엔드 무변경 확장이다(3D 의 transform_json.floor 와 동일 선례).
 * React/zustand 비의존 순수 TS — node:test 가 직접 검증한다.</p>
 *
 * <p>배정(assignments)은 eqpKey(문자열 키) → groupId 맵이고, <b>맵에 없는 설비 = 미배정 그룹 소속</b>
 * (여집합)이다. 그룹 삭제 시 배정만 지우면 설비가 미배정으로 복귀하고, 라인에 새 설비가 추가되면
 * 자동으로 미배정에 나타난다 — 댕글링 참조가 모델 차원에서 생기지 않는다.</p>
 */

/** 미배정 예약 그룹 id — 항상 존재, 생성/삭제 불가. 표시 이름은 i18n 라벨(저장 안 함). */
export const LIVE_MAP_UNASSIGNED_GROUP_ID = 'unassigned'

/** 그룹 드래그/리사이즈 스냅 격자(px) — 보드 배경 점 격자(.live-map-canvas)와 1:1(점 1칸 = 1스텝). */
export const LIVE_MAP_FLOW_SNAP_PX = 20

const snapToFlowGrid = (px: number): number =>
  Math.round(px / LIVE_MAP_FLOW_SNAP_PX) * LIVE_MAP_FLOW_SNAP_PX

/** 신규 그룹 기본 크기(px) — 기존 공정 카드와 동일. */
export const LIVE_MAP_FLOW_GROUP_DEFAULT_SIZE = { width: 168, height: 224 } as const

/** 그룹 최소 크기(px) — 헤더+상태바가 들어가는 하한(스냅 격자 배수). */
export const LIVE_MAP_FLOW_GROUP_MIN_SIZE = { width: 120, height: 120 } as const

/** 미배정 그룹 기본 배치 — 첫 진입 시 전체 설비가 들어가므로 넓게 잡는다. */
export const LIVE_MAP_FLOW_UNASSIGNED_DEFAULT = {
  x: 24,
  y: 56,
  width: 336,
  height: 560,
} as const

export interface LiveMapFlowGroup {
  id: string
  /** 미배정 그룹은 빈 문자열(렌더 시 i18n 라벨로 대체). */
  title: string
  subtitle: string
  /** hex 색. null 이면 테마 기본 액센트. */
  color: string | null
  x: number
  y: number
  width: number
  height: number
}

export type LiveMapFlowArrowDash = 'solid' | 'dashed' | 'dotted'

/** 그룹 간 흐름 화살표 — 개별 객체로 생성/삭제하며 스타일(굵기/색/선 종류)을 따로 가진다. */
export interface LiveMapFlowArrow {
  id: string
  fromGroupId: string
  toGroupId: string
  /** hex 색. null 이면 테마 기본 액센트. */
  color: string | null
  strokeWidth: number
  dash: LiveMapFlowArrowDash
}

/** 화살표 스타일 기본값 — 신규 생성 다이얼로그 초기값. */
export const LIVE_MAP_FLOW_ARROW_DEFAULT_STYLE = {
  color: null,
  strokeWidth: 2,
  dash: 'solid',
} as const satisfies Pick<LiveMapFlowArrow, 'color' | 'strokeWidth' | 'dash'>

export interface LiveMapFlowJson {
  groups: LiveMapFlowGroup[]
  /** eqpKey(문자열) → groupId. 미등재 = 미배정. */
  assignments: Record<string, string>
  arrows: LiveMapFlowArrow[]
}

/** canvas_json 에 flow 키가 얹힌 형태 — CanvasJson 스키마(빌더 메타)는 건드리지 않는다. */
type FlowCanvasJson = CanvasJson & { flow?: unknown }

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const createUnassignedGroup = (): LiveMapFlowGroup => ({
  id: LIVE_MAP_UNASSIGNED_GROUP_ID,
  title: '',
  subtitle: '',
  color: null,
  ...LIVE_MAP_FLOW_UNASSIGNED_DEFAULT,
})

/** 첫 진입(저장된 flow 없음) 기본 flow — 미배정 그룹 1개 + 빈 배정 + 빈 화살표. */
export const createDefaultLiveMapFlow = (): LiveMapFlowJson => ({
  groups: [createUnassignedGroup()],
  assignments: {},
  arrows: [],
})

const sanitizeGroup = (value: unknown): LiveMapFlowGroup | null => {
  if (!isPlainObject(value)) {
    return null
  }
  const { id, title, subtitle, color, x, y, width, height } = value
  if (typeof id !== 'string' || id.length === 0) {
    return null
  }
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) {
    return null
  }
  return {
    id,
    title: typeof title === 'string' ? title : '',
    subtitle: typeof subtitle === 'string' ? subtitle : '',
    color: typeof color === 'string' ? color : null,
    x,
    y,
    width,
    height,
  }
}

const ARROW_DASHES: readonly LiveMapFlowArrowDash[] = ['solid', 'dashed', 'dotted']

/**
 * 화살표 1개 정화 — 끝점 그룹이 둘 다 살아있는 화살표만 유지(셀프 루프 제외).
 * 스타일 필드는 깨져도 화살표를 버리지 않고 기본값으로 복구한다.
 */
const sanitizeArrow = (value: unknown, groupIds: ReadonlySet<string>): LiveMapFlowArrow | null => {
  if (!isPlainObject(value)) {
    return null
  }
  const { id, fromGroupId, toGroupId, color, strokeWidth, dash } = value
  if (typeof id !== 'string' || id.length === 0) {
    return null
  }
  if (typeof fromGroupId !== 'string' || typeof toGroupId !== 'string') {
    return null
  }
  if (!groupIds.has(fromGroupId) || !groupIds.has(toGroupId) || fromGroupId === toGroupId) {
    return null
  }
  return {
    id,
    fromGroupId,
    toGroupId,
    color: typeof color === 'string' ? color : null,
    strokeWidth:
      isFiniteNumber(strokeWidth) && strokeWidth > 0
        ? strokeWidth
        : LIVE_MAP_FLOW_ARROW_DEFAULT_STYLE.strokeWidth,
    dash: ARROW_DASHES.includes(dash as LiveMapFlowArrowDash)
      ? (dash as LiveMapFlowArrowDash)
      : LIVE_MAP_FLOW_ARROW_DEFAULT_STYLE.dash,
  }
}

/**
 * canvas_json 의 flow 를 파싱합니다. 없거나 형식이 깨졌으면 null(호출자가 기본 flow 사용).
 * 항목 단위 정화: 깨진 그룹은 버리고, 미배정 그룹이 없으면 추가하고, 중복 id 는 첫 항목만 남긴다.
 * 화살표는 끝점 그룹이 살아있는 것만 유지한다(arrows 키 없는 구버전 flow 는 빈 배열).
 */
export const parseLiveMapFlow = (canvasJson: CanvasJson | null | undefined): LiveMapFlowJson | null => {
  const flow = (canvasJson as FlowCanvasJson | null | undefined)?.flow
  if (!isPlainObject(flow) || !Array.isArray(flow.groups)) {
    return null
  }

  const seenIds = new Set<string>()
  const groups: LiveMapFlowGroup[] = []
  for (const entry of flow.groups) {
    const group = sanitizeGroup(entry)
    if (group && !seenIds.has(group.id)) {
      seenIds.add(group.id)
      groups.push(group)
    }
  }
  if (!seenIds.has(LIVE_MAP_UNASSIGNED_GROUP_ID)) {
    groups.unshift(createUnassignedGroup())
  }

  const assignments: Record<string, string> = {}
  if (isPlainObject(flow.assignments)) {
    for (const [eqpKey, groupId] of Object.entries(flow.assignments)) {
      if (typeof groupId === 'string') {
        assignments[eqpKey] = groupId
      }
    }
  }

  // seenIds 가 아닌 최종 groups 기준 — 미배정 그룹이 자동 추가(unshift)된 경우도 끝점으로 인정.
  const groupIds = new Set(groups.map((group) => group.id))
  const seenArrowIds = new Set<string>()
  const arrows: LiveMapFlowArrow[] = []
  if (Array.isArray(flow.arrows)) {
    for (const entry of flow.arrows) {
      const arrow = sanitizeArrow(entry, groupIds)
      if (arrow && !seenArrowIds.has(arrow.id)) {
        seenArrowIds.add(arrow.id)
        arrows.push(arrow)
      }
    }
  }

  return { groups, assignments, arrows }
}

/**
 * 저장용 canvas_json 합성 — 기존 캔버스(빌더 메타·미래 키)를 보존하고 flow 만 교체합니다.
 * 기존 canvas 가 없으면 프론트 기본 캔버스 위에 얹는다(v 포함 → 서버 검증 통과).
 */
export const buildLiveMapFlowCanvasJson = (
  serverCanvasJson: CanvasJson | null | undefined,
  flow: LiveMapFlowJson,
): CanvasJson => {
  const base: FlowCanvasJson = serverCanvasJson ?? DEFAULT_CANVAS_JSON
  return { ...base, flow } as CanvasJson
}

/** 설비의 소속 그룹 id — 배정이 없거나 배정된 그룹이 사라졌으면 미배정. */
export const resolveLiveMapFlowGroupId = (flow: LiveMapFlowJson, eqpKey: number): string => {
  const assigned = flow.assignments[String(eqpKey)]
  if (assigned && flow.groups.some((group) => group.id === assigned)) {
    return assigned
  }
  return LIVE_MAP_UNASSIGNED_GROUP_ID
}

/** 설비 목록을 그룹별로 분류합니다(미배정 포함, 모든 그룹 키 보장). */
export const groupLiveMapFlowMembers = <T extends { eqpKey: number }>(
  flow: LiveMapFlowJson,
  items: readonly T[],
): Map<string, T[]> => {
  const byGroup = new Map<string, T[]>(flow.groups.map((group) => [group.id, []]))
  for (const item of items) {
    byGroup.get(resolveLiveMapFlowGroupId(flow, item.eqpKey))?.push(item)
  }
  return byGroup
}

/** 그룹 이동 — 스냅 격자에 맞추고 보드 안으로 clamp 한 새 flow 를 반환합니다(입력 불변). */
export const moveLiveMapFlowGroup = (
  flow: LiveMapFlowJson,
  groupId: string,
  x: number,
  y: number,
  boardWidth: number,
  boardHeight: number,
): LiveMapFlowJson => ({
  ...flow,
  groups: flow.groups.map((group) => {
    if (group.id !== groupId) {
      return group
    }
    const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(0, max))
    return {
      ...group,
      x: clamp(snapToFlowGrid(x), boardWidth - group.width),
      y: clamp(snapToFlowGrid(y), boardHeight - group.height),
    }
  }),
})

/**
 * 그룹 크기 변경 — 스냅 격자에 맞추고 [최소 크기, 보드 잔여 공간] 으로 clamp 한 새 flow 를
 * 반환합니다(입력 불변). 위치 이동과 마찬가지로 미배정 그룹도 허용한다.
 */
export const resizeLiveMapFlowGroup = (
  flow: LiveMapFlowJson,
  groupId: string,
  width: number,
  height: number,
  boardWidth: number,
  boardHeight: number,
): LiveMapFlowJson => ({
  ...flow,
  groups: flow.groups.map((group) => {
    if (group.id !== groupId) {
      return group
    }
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), Math.max(min, max))
    return {
      ...group,
      width: clamp(snapToFlowGrid(width), LIVE_MAP_FLOW_GROUP_MIN_SIZE.width, boardWidth - group.x),
      height: clamp(
        snapToFlowGrid(height),
        LIVE_MAP_FLOW_GROUP_MIN_SIZE.height,
        boardHeight - group.y,
      ),
    }
  }),
})

/** 신규 그룹 추가 — 겹침을 피해 격자 계단식 위치에 놓은 새 flow 를 반환합니다(입력 불변). */
export const addLiveMapFlowGroup = (
  flow: LiveMapFlowJson,
  group: Pick<LiveMapFlowGroup, 'id' | 'title'>,
): LiveMapFlowJson => {
  if (flow.groups.some((existing) => existing.id === group.id)) {
    throw new Error(`flow group id already exists: ${group.id}`)
  }
  const offset = snapToFlowGrid(40 + (flow.groups.length % 8) * 40)
  return {
    ...flow,
    groups: [
      ...flow.groups,
      {
        id: group.id,
        title: group.title,
        subtitle: '',
        color: null,
        x: offset + 400,
        y: offset,
        ...LIVE_MAP_FLOW_GROUP_DEFAULT_SIZE,
      },
    ],
  }
}

/** 그룹 표시 속성(이름/부제/색) 변경 — 미배정 그룹은 위치 외 변경 불가(호출 자체가 invariant 위반). */
export const updateLiveMapFlowGroup = (
  flow: LiveMapFlowJson,
  groupId: string,
  patch: Partial<Pick<LiveMapFlowGroup, 'title' | 'subtitle' | 'color'>>,
): LiveMapFlowJson => {
  if (groupId === LIVE_MAP_UNASSIGNED_GROUP_ID) {
    throw new Error('unassigned group is not editable')
  }
  return {
    ...flow,
    groups: flow.groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
  }
}

/**
 * 설비 배정 변경(드래그&드롭) — 미배정 그룹으로 보내면 배정 항목을 제거합니다(여집합 규칙).
 * 존재하지 않는 그룹으로의 배정은 invariant 위반(Error). 변화가 없으면 입력 flow 를 그대로 반환.
 */
export const assignLiveMapFlowEquipment = (
  flow: LiveMapFlowJson,
  eqpKey: number,
  groupId: string,
): LiveMapFlowJson => {
  if (!flow.groups.some((group) => group.id === groupId)) {
    throw new Error(`flow group not found: ${groupId}`)
  }
  const key = String(eqpKey)
  if (groupId === LIVE_MAP_UNASSIGNED_GROUP_ID) {
    if (!(key in flow.assignments)) {
      return flow
    }
    const assignments = { ...flow.assignments }
    delete assignments[key]
    return { ...flow, assignments }
  }
  if (flow.assignments[key] === groupId) {
    return flow
  }
  return { ...flow, assignments: { ...flow.assignments, [key]: groupId } }
}

/**
 * 그룹 삭제 — 그룹 + 해당 그룹으로의 배정(설비는 미배정으로 복귀) + 그룹에 닿은 화살표를 제거합니다.
 * 미배정 그룹은 삭제 불가(invariant 위반 시 Error).
 */
export const removeLiveMapFlowGroup = (flow: LiveMapFlowJson, groupId: string): LiveMapFlowJson => {
  if (groupId === LIVE_MAP_UNASSIGNED_GROUP_ID) {
    throw new Error('unassigned group cannot be removed')
  }
  const assignments: Record<string, string> = {}
  for (const [eqpKey, assignedGroupId] of Object.entries(flow.assignments)) {
    if (assignedGroupId !== groupId) {
      assignments[eqpKey] = assignedGroupId
    }
  }
  return {
    groups: flow.groups.filter((group) => group.id !== groupId),
    assignments,
    arrows: flow.arrows.filter(
      (arrow) => arrow.fromGroupId !== groupId && arrow.toGroupId !== groupId,
    ),
  }
}

/** 화살표 스타일/끝점 patch 입력 — id 를 제외한 전체 필드(다이얼로그가 항상 전체를 제출). */
export type LiveMapFlowArrowPatch = Omit<LiveMapFlowArrow, 'id'>

/** 화살표 끝점 invariant — 두 그룹 모두 존재해야 하고 셀프 루프는 불가. */
const assertArrowEndpoints = (flow: LiveMapFlowJson, fromGroupId: string, toGroupId: string) => {
  for (const groupId of [fromGroupId, toGroupId]) {
    if (!flow.groups.some((group) => group.id === groupId)) {
      throw new Error(`flow group not found: ${groupId}`)
    }
  }
  if (fromGroupId === toGroupId) {
    throw new Error('flow arrow endpoints must differ')
  }
}

/** 화살표 추가 — 중복 id/없는 그룹/셀프 루프는 invariant 위반(Error). 입력 불변. */
export const addLiveMapFlowArrow = (
  flow: LiveMapFlowJson,
  arrow: LiveMapFlowArrow,
): LiveMapFlowJson => {
  if (flow.arrows.some((existing) => existing.id === arrow.id)) {
    throw new Error(`flow arrow id already exists: ${arrow.id}`)
  }
  assertArrowEndpoints(flow, arrow.fromGroupId, arrow.toGroupId)
  return { ...flow, arrows: [...flow.arrows, { ...arrow }] }
}

/** 화살표 끝점/스타일 변경 — 없는 화살표·없는 그룹·셀프 루프는 invariant 위반(Error). 입력 불변. */
export const updateLiveMapFlowArrow = (
  flow: LiveMapFlowJson,
  arrowId: string,
  patch: LiveMapFlowArrowPatch,
): LiveMapFlowJson => {
  if (!flow.arrows.some((arrow) => arrow.id === arrowId)) {
    throw new Error(`flow arrow not found: ${arrowId}`)
  }
  assertArrowEndpoints(flow, patch.fromGroupId, patch.toGroupId)
  return {
    ...flow,
    arrows: flow.arrows.map((arrow) => (arrow.id === arrowId ? { ...patch, id: arrow.id } : arrow)),
  }
}

/** 화살표 삭제 — 없는 id 는 no-op(이미 지워진 상태와 동치). 입력 불변. */
export const removeLiveMapFlowArrow = (flow: LiveMapFlowJson, arrowId: string): LiveMapFlowJson => ({
  ...flow,
  arrows: flow.arrows.filter((arrow) => arrow.id !== arrowId),
})

/**
 * 그룹 rect 중심을 잇는 선이 양쪽 rect 테두리와 만나는 두 점 — 보드 SVG 화살표 좌표입니다.
 * 두 rect 가 겹치거나 중심이 같아 선분이 성립하지 않으면 null(렌더 생략).
 */
export const computeLiveMapFlowArrowLine = (
  from: Pick<LiveMapFlowGroup, 'x' | 'y' | 'width' | 'height'>,
  to: Pick<LiveMapFlowGroup, 'x' | 'y' | 'width' | 'height'>,
): { x1: number; y1: number; x2: number; y2: number } | null => {
  const fromCx = from.x + from.width / 2
  const fromCy = from.y + from.height / 2
  const toCx = to.x + to.width / 2
  const toCy = to.y + to.height / 2
  const dx = toCx - fromCx
  const dy = toCy - fromCy
  if (dx === 0 && dy === 0) {
    return null
  }
  // 중심→중심 전체 벡터 대비, rect 테두리 교차 지점의 비율 t(0~).
  const exitT = (rect: Pick<LiveMapFlowGroup, 'width' | 'height'>) =>
    Math.min(
      dx === 0 ? Number.POSITIVE_INFINITY : rect.width / 2 / Math.abs(dx),
      dy === 0 ? Number.POSITIVE_INFINITY : rect.height / 2 / Math.abs(dy),
    )
  const fromT = exitT(from)
  const toT = exitT(to)
  if (fromT + toT >= 1) {
    // 테두리 교차점이 서로를 지나친다 = 두 rect 가 겹침.
    return null
  }
  return {
    x1: fromCx + dx * fromT,
    y1: fromCy + dy * fromT,
    x2: toCx - dx * toT,
    y2: toCy - dy * toT,
  }
}
