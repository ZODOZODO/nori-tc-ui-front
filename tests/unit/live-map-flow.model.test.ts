import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addLiveMapFlowArrow,
  addLiveMapFlowGroup,
  assignLiveMapFlowEquipment,
  buildLiveMapFlowCanvasJson,
  computeLiveMapFlowArrowLine,
  createDefaultLiveMapFlow,
  groupLiveMapFlowMembers,
  LIVE_MAP_FLOW_GROUP_DEFAULT_SIZE,
  LIVE_MAP_FLOW_GROUP_MIN_SIZE,
  LIVE_MAP_UNASSIGNED_GROUP_ID,
  moveLiveMapFlowGroup,
  parseLiveMapFlow,
  removeLiveMapFlowArrow,
  removeLiveMapFlowGroup,
  resizeLiveMapFlowGroup,
  resolveLiveMapFlowGroupId,
  updateLiveMapFlowArrow,
  updateLiveMapFlowGroup,
  type LiveMapFlowArrow,
  type LiveMapFlowJson,
} from '@/features/live-map/lib/live-map-flow.model.ts'
import { DEFAULT_CANVAS_JSON, type CanvasJson } from '@/features/live-map/lib/live-map-layout.model.ts'

const flowWith = (overrides: Partial<LiveMapFlowJson>): LiveMapFlowJson => ({
  groups: [
    { id: LIVE_MAP_UNASSIGNED_GROUP_ID, title: '', subtitle: '', color: null, x: 24, y: 56, width: 336, height: 560 },
    { id: 'g-1', title: '증착', subtitle: 'CVD', color: '#38bdf8', x: 400, y: 40, width: 168, height: 224 },
  ],
  assignments: { '101': 'g-1' },
  arrows: [],
  ...overrides,
})

const arrowWith = (overrides: Partial<LiveMapFlowArrow>): LiveMapFlowArrow => ({
  id: 'a-1',
  fromGroupId: LIVE_MAP_UNASSIGNED_GROUP_ID,
  toGroupId: 'g-1',
  color: '#ef4444',
  strokeWidth: 4,
  dash: 'dashed',
  ...overrides,
})

test('parseLiveMapFlow — flow 없는 canvas 는 null(호출자가 기본 flow 사용)', () => {
  assert.equal(parseLiveMapFlow(null), null)
  assert.equal(parseLiveMapFlow(DEFAULT_CANVAS_JSON), null)
  assert.equal(parseLiveMapFlow({ ...DEFAULT_CANVAS_JSON, flow: { groups: 'broken' } } as CanvasJson), null)
})

test('parseLiveMapFlow — 저장된 flow(화살표 포함)를 round-trip 으로 복원한다', () => {
  const flow = flowWith({ arrows: [arrowWith({})] })
  const canvas = buildLiveMapFlowCanvasJson(DEFAULT_CANVAS_JSON, flow)
  assert.deepEqual(parseLiveMapFlow(canvas), flow)
})

test('parseLiveMapFlow — 깨진 그룹/중복 id/비문자 배정은 버리고 미배정 그룹을 보장한다', () => {
  const canvas = {
    ...DEFAULT_CANVAS_JSON,
    flow: {
      groups: [
        { id: 'g-1', title: 'A', x: 0, y: 0, width: 168, height: 224 },
        { id: 'g-1', title: 'DUP', x: 40, y: 40, width: 168, height: 224 },
        { id: '', title: 'no-id', x: 0, y: 0, width: 168, height: 224 },
        { id: 'g-2', title: 'NaN', x: Number.NaN, y: 0, width: 168, height: 224 },
        'not-an-object',
      ],
      assignments: { '101': 'g-1', '102': 7 },
    },
  } as unknown as CanvasJson

  const parsed = parseLiveMapFlow(canvas)
  assert.ok(parsed)
  assert.deepEqual(
    parsed.groups.map((group) => group.id),
    [LIVE_MAP_UNASSIGNED_GROUP_ID, 'g-1'],
  )
  assert.equal(parsed.groups[1].title, 'A')
  assert.equal(parsed.groups[1].subtitle, '')
  assert.equal(parsed.groups[1].color, null)
  assert.deepEqual(parsed.assignments, { '101': 'g-1' })
})

test('createDefaultLiveMapFlow — 미배정 그룹 1개 + 빈 배정 + 빈 화살표', () => {
  const flow = createDefaultLiveMapFlow()
  assert.equal(flow.groups.length, 1)
  assert.equal(flow.groups[0].id, LIVE_MAP_UNASSIGNED_GROUP_ID)
  assert.deepEqual(flow.assignments, {})
  assert.deepEqual(flow.arrows, [])
})

test('parseLiveMapFlow — arrows 없는 구버전 flow 는 빈 배열, 깨진/댕글링/중복/셀프루프 화살표는 버린다', () => {
  const legacy = buildLiveMapFlowCanvasJson(DEFAULT_CANVAS_JSON, flowWith({})) as CanvasJson & {
    flow: Record<string, unknown>
  }
  delete legacy.flow.arrows
  assert.deepEqual(parseLiveMapFlow(legacy)?.arrows, [])

  const canvas = {
    ...DEFAULT_CANVAS_JSON,
    flow: {
      groups: flowWith({}).groups,
      assignments: {},
      arrows: [
        arrowWith({}),
        arrowWith({ id: 'a-1', color: '#000000' }), // 중복 id — 첫 항목만
        arrowWith({ id: 'a-dangling', toGroupId: 'ghost' }),
        arrowWith({ id: 'a-self', toGroupId: LIVE_MAP_UNASSIGNED_GROUP_ID }),
        arrowWith({ id: 'a-style', color: 7, strokeWidth: -1, dash: 'zigzag' } as never),
        'not-an-object',
      ],
    },
  } as unknown as CanvasJson

  const parsed = parseLiveMapFlow(canvas)
  assert.ok(parsed)
  assert.deepEqual(
    parsed.arrows.map((arrow) => arrow.id),
    ['a-1', 'a-style'],
  )
  assert.equal(parsed.arrows[0].color, '#ef4444')
  // 스타일 필드만 깨진 화살표는 버리지 않고 기본 스타일로 복구.
  assert.deepEqual(parsed.arrows[1], arrowWith({ id: 'a-style', color: null, strokeWidth: 2, dash: 'solid' }))
})

test('buildLiveMapFlowCanvasJson — 기존 캔버스 키를 보존하고 flow 만 교체, 없으면 기본 캔버스(v 포함)', () => {
  const existing = { ...DEFAULT_CANVAS_JSON, background: '#123456' }
  const flow = createDefaultLiveMapFlow()
  const merged = buildLiveMapFlowCanvasJson(existing, flow) as CanvasJson & { flow?: unknown }
  assert.equal(merged.background, '#123456')
  assert.equal(merged.v, DEFAULT_CANVAS_JSON.v)
  assert.deepEqual(merged.flow, flow)

  const fromNull = buildLiveMapFlowCanvasJson(null, flow) as CanvasJson & { flow?: unknown }
  assert.equal(fromNull.v, DEFAULT_CANVAS_JSON.v)
  assert.deepEqual(fromNull.flow, flow)
})

test('resolveLiveMapFlowGroupId — 배정 없음/사라진 그룹 배정은 미배정으로 폴백', () => {
  const flow = flowWith({ assignments: { '101': 'g-1', '102': 'ghost' } })
  assert.equal(resolveLiveMapFlowGroupId(flow, 101), 'g-1')
  assert.equal(resolveLiveMapFlowGroupId(flow, 102), LIVE_MAP_UNASSIGNED_GROUP_ID)
  assert.equal(resolveLiveMapFlowGroupId(flow, 999), LIVE_MAP_UNASSIGNED_GROUP_ID)
})

test('groupLiveMapFlowMembers — 모든 그룹 키를 보장하며 설비를 분류한다', () => {
  const flow = flowWith({})
  const members = groupLiveMapFlowMembers(flow, [{ eqpKey: 101 }, { eqpKey: 102 }])
  assert.deepEqual(members.get('g-1'), [{ eqpKey: 101 }])
  assert.deepEqual(members.get(LIVE_MAP_UNASSIGNED_GROUP_ID), [{ eqpKey: 102 }])
})

test('moveLiveMapFlowGroup — 20px(점 격자) 스냅 + 보드 경계 clamp, 다른 그룹 불변', () => {
  const flow = flowWith({})
  const moved = moveLiveMapFlowGroup(flow, 'g-1', 57, 1000, 1350, 710)
  const group = moved.groups.find((entry) => entry.id === 'g-1')
  assert.ok(group)
  assert.equal(group.x, 60)
  assert.equal(group.y, 710 - 224)
  assert.deepEqual(moved.groups[0], flow.groups[0])
  // 입력 불변
  assert.equal(flow.groups[1].x, 400)
})

test('resizeLiveMapFlowGroup — 20px(점 격자) 스냅 + [최소, 보드 잔여] clamp, 다른 그룹 불변', () => {
  const flow = flowWith({})
  // g-1(x=400, y=40): width 57 → 스냅 60 → 최소 120, height 1000 → 보드(710) - y(40) = 670.
  const resized = resizeLiveMapFlowGroup(flow, 'g-1', 57, 1000, 1350, 710)
  const group = resized.groups.find((entry) => entry.id === 'g-1')
  assert.ok(group)
  assert.equal(group.width, LIVE_MAP_FLOW_GROUP_MIN_SIZE.width)
  assert.equal(group.height, 710 - 40)
  assert.deepEqual(resized.groups[0], flow.groups[0])
  // 입력 불변
  assert.equal(flow.groups[1].width, 168)
})

test('resizeLiveMapFlowGroup — 미배정 그룹도 크기 조절 가능, 없는 id 는 no-op', () => {
  const flow = flowWith({})
  const resized = resizeLiveMapFlowGroup(flow, LIVE_MAP_UNASSIGNED_GROUP_ID, 410, 390, 1350, 710)
  const unassigned = resized.groups.find((entry) => entry.id === LIVE_MAP_UNASSIGNED_GROUP_ID)
  assert.ok(unassigned)
  assert.equal(unassigned.width, 420)
  assert.equal(unassigned.height, 400)

  assert.deepEqual(resizeLiveMapFlowGroup(flow, 'ghost', 400, 400, 1350, 710).groups, flow.groups)
})

test('addLiveMapFlowGroup — 기본 크기로 추가, 중복 id 는 명시 에러', () => {
  const flow = createDefaultLiveMapFlow()
  const added = addLiveMapFlowGroup(flow, { id: 'g-new', title: '새 그룹' })
  const group = added.groups.find((entry) => entry.id === 'g-new')
  assert.ok(group)
  assert.equal(group.width, LIVE_MAP_FLOW_GROUP_DEFAULT_SIZE.width)
  assert.equal(group.height, LIVE_MAP_FLOW_GROUP_DEFAULT_SIZE.height)
  assert.equal(group.x % 40, 0)
  assert.equal(group.y % 40, 0)
  assert.throws(() => addLiveMapFlowGroup(added, { id: 'g-new', title: 'dup' }), /already exists/)
})

test('assignLiveMapFlowEquipment — 그룹 배정/재배정, 미배정 이동은 항목 제거, 무변화는 입력 그대로', () => {
  const flow = flowWith({})

  const assigned = assignLiveMapFlowEquipment(flow, 102, 'g-1')
  assert.deepEqual(assigned.assignments, { '101': 'g-1', '102': 'g-1' })

  const unassigned = assignLiveMapFlowEquipment(assigned, 101, LIVE_MAP_UNASSIGNED_GROUP_ID)
  assert.deepEqual(unassigned.assignments, { '102': 'g-1' })

  // 무변화(같은 그룹 재배정 / 이미 미배정) — 입력 객체 동일 반환(불필요 dirty 방지).
  assert.equal(assignLiveMapFlowEquipment(assigned, 102, 'g-1'), assigned)
  assert.equal(assignLiveMapFlowEquipment(unassigned, 101, LIVE_MAP_UNASSIGNED_GROUP_ID), unassigned)

  assert.throws(() => assignLiveMapFlowEquipment(flow, 101, 'ghost'), /not found/)
  // 입력 불변
  assert.deepEqual(flow.assignments, { '101': 'g-1' })
})

test('updateLiveMapFlowGroup — 표시 속성 patch, 미배정 그룹은 편집 불가', () => {
  const flow = flowWith({})
  const updated = updateLiveMapFlowGroup(flow, 'g-1', { title: '연마', color: null })
  const group = updated.groups.find((entry) => entry.id === 'g-1')
  assert.ok(group)
  assert.equal(group.title, '연마')
  assert.equal(group.color, null)
  assert.equal(group.subtitle, 'CVD')
  assert.throws(
    () => updateLiveMapFlowGroup(flow, LIVE_MAP_UNASSIGNED_GROUP_ID, { title: 'x' }),
    /not editable/,
  )
})

test('removeLiveMapFlowGroup — 그룹 + 해당 배정 + 닿은 화살표 제거(설비 미배정 복귀), 미배정 그룹은 삭제 불가', () => {
  const flow = flowWith({
    assignments: { '101': 'g-1', '202': 'g-other' },
    arrows: [arrowWith({}), arrowWith({ id: 'a-keep', fromGroupId: 'g-1', toGroupId: LIVE_MAP_UNASSIGNED_GROUP_ID })],
  })
  const removed = removeLiveMapFlowGroup(flow, 'g-1')
  assert.deepEqual(
    removed.groups.map((group) => group.id),
    [LIVE_MAP_UNASSIGNED_GROUP_ID],
  )
  assert.deepEqual(removed.assignments, { '202': 'g-other' })
  // 양방향 모두 cascade — fromGroupId/toGroupId 어느 쪽이든 g-1 에 닿으면 제거.
  assert.deepEqual(removed.arrows, [])
  assert.throws(() => removeLiveMapFlowGroup(flow, LIVE_MAP_UNASSIGNED_GROUP_ID), /cannot be removed/)
})

test('addLiveMapFlowArrow — 추가/중복 id/없는 그룹/셀프 루프, 입력 불변', () => {
  const flow = flowWith({})
  const arrow = arrowWith({})
  const added = addLiveMapFlowArrow(flow, arrow)
  assert.deepEqual(added.arrows, [arrow])
  assert.deepEqual(flow.arrows, [])

  assert.throws(() => addLiveMapFlowArrow(added, arrowWith({})), /already exists/)
  assert.throws(() => addLiveMapFlowArrow(flow, arrowWith({ toGroupId: 'ghost' })), /not found/)
  assert.throws(
    () => addLiveMapFlowArrow(flow, arrowWith({ toGroupId: LIVE_MAP_UNASSIGNED_GROUP_ID })),
    /must differ/,
  )
})

test('updateLiveMapFlowArrow — 끝점/스타일 전체 patch, 없는 화살표·불량 끝점은 명시 에러', () => {
  const flow = flowWith({ arrows: [arrowWith({})] })
  const updated = updateLiveMapFlowArrow(flow, 'a-1', {
    fromGroupId: 'g-1',
    toGroupId: LIVE_MAP_UNASSIGNED_GROUP_ID,
    color: null,
    strokeWidth: 6,
    dash: 'dotted',
  })
  assert.deepEqual(updated.arrows, [
    arrowWith({
      fromGroupId: 'g-1',
      toGroupId: LIVE_MAP_UNASSIGNED_GROUP_ID,
      color: null,
      strokeWidth: 6,
      dash: 'dotted',
    }),
  ])
  assert.equal(flow.arrows[0].strokeWidth, 4)

  assert.throws(() => updateLiveMapFlowArrow(flow, 'ghost', arrowWith({})), /arrow not found/)
  assert.throws(
    () => updateLiveMapFlowArrow(flow, 'a-1', arrowWith({ toGroupId: 'ghost' })),
    /group not found/,
  )
  assert.throws(
    () => updateLiveMapFlowArrow(flow, 'a-1', arrowWith({ fromGroupId: 'g-1' })),
    /must differ/,
  )
})

test('removeLiveMapFlowArrow — 해당 화살표만 제거, 없는 id 는 no-op', () => {
  const flow = flowWith({ arrows: [arrowWith({}), arrowWith({ id: 'a-2' })] })
  const removed = removeLiveMapFlowArrow(flow, 'a-1')
  assert.deepEqual(
    removed.arrows.map((arrow) => arrow.id),
    ['a-2'],
  )
  assert.deepEqual(removeLiveMapFlowArrow(flow, 'ghost').arrows, flow.arrows)
})

test('computeLiveMapFlowArrowLine — rect 테두리 간 선분, 겹침/동일 중심은 null', () => {
  // 수평으로 떨어진 두 rect — 오른쪽 테두리 → 왼쪽 테두리.
  const left = { x: 0, y: 0, width: 100, height: 100 }
  const right = { x: 300, y: 0, width: 100, height: 100 }
  assert.deepEqual(computeLiveMapFlowArrowLine(left, right), { x1: 100, y1: 50, x2: 300, y2: 50 })

  // 겹치는 두 rect / 동일 중심 — 선분 불성립.
  assert.equal(computeLiveMapFlowArrowLine(left, { x: 50, y: 0, width: 100, height: 100 }), null)
  assert.equal(computeLiveMapFlowArrowLine(left, { x: 0, y: 0, width: 100, height: 100 }), null)
})
