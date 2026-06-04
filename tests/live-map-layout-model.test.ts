import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildShapeJson,
  buildTransformJson,
  clampScale,
  DEFAULT_CANVAS_JSON,
  DEFAULT_IMAGE_SRC,
  hasSchemaVersion,
  isPrimitiveClassName,
  liftTransformsToFront,
  LIVE_MAP_SCHEMA_VERSION,
  MAX_PLACEMENT_SCALE,
  MIN_PLACEMENT_SCALE,
  scaleTransform,
  sinkTransformsToBack,
  sortByDepth,
  toggleSelection,
  validatePlacementEqpBinding,
  validateShapeJson,
  type KonvaNode,
  type TransformJson,
} from '../src/features/live-map/lib/live-map-layout.model.ts'

const rect: KonvaNode = { className: 'Rect', attrs: { x: 0, y: 0, width: 80, height: 40 } }
const line: KonvaNode = { className: 'Line', attrs: { points: [0, 40, 80, 40] } }

test('buildShapeJson wraps primitives in a versioned Group root', () => {
  const shape = buildShapeJson({ name: 'pump-01' }, [rect, line])
  assert.equal(shape.v, LIVE_MAP_SCHEMA_VERSION)
  assert.equal(shape.root.className, 'Group')
  assert.equal(shape.root.attrs.name, 'pump-01')
  assert.equal(shape.root.children?.length, 2)
  assert.equal(shape.root.children?.[0].className, 'Rect')
})

test('buildShapeJson returns a fresh children array (top-level node copies)', () => {
  const children: KonvaNode[] = [{ className: 'Rect', attrs: { x: 0 } }]
  const shape = buildShapeJson({}, children)
  assert.notEqual(shape.root.children, children)
  assert.notEqual(shape.root.children?.[0], children[0])
})

test('validateShapeJson accepts a well-formed shape', () => {
  const shape = buildShapeJson({}, [rect])
  assert.deepEqual(validateShapeJson(shape), shape)
})

test('validateShapeJson rejects a missing schema version', () => {
  assert.throws(() => validateShapeJson({ root: { className: 'Group', attrs: {} } }))
})

test('validateShapeJson rejects a non-Group root', () => {
  assert.throws(() => validateShapeJson({ v: 1, root: { className: 'Rect', attrs: {} } }))
})

test('hasSchemaVersion requires an integer v', () => {
  assert.equal(hasSchemaVersion({ v: 1 }), true)
  assert.equal(hasSchemaVersion({ v: 1.5 }), false)
  assert.equal(hasSchemaVersion({ width: 1 }), false)
  assert.equal(hasSchemaVersion(null), false)
})

test('buildTransformJson fills 2.5D defaults and applies overrides', () => {
  const transform = buildTransformJson({ x: 320, y: 180, skewX: 30, depth: 12 })
  assert.equal(transform.v, LIVE_MAP_SCHEMA_VERSION)
  assert.equal(transform.x, 320)
  assert.equal(transform.skewX, 30)
  assert.equal(transform.depth, 12)
  assert.equal(transform.scaleX, 1)
  assert.equal(transform.skewY, 0)
  assert.equal(transform.zIndex, 0)
})

test('validatePlacementEqpBinding enforces EQUIPMENT requires eqpKey', () => {
  assert.equal(validatePlacementEqpBinding('EQUIPMENT', 5), null)
  assert.notEqual(validatePlacementEqpBinding('EQUIPMENT', null), null)
  assert.notEqual(validatePlacementEqpBinding('EQUIPMENT', undefined), null)
})

test('validatePlacementEqpBinding enforces STRUCTURE forbids eqpKey', () => {
  assert.equal(validatePlacementEqpBinding('STRUCTURE', null), null)
  assert.notEqual(validatePlacementEqpBinding('STRUCTURE', 5), null)
})

test('sortByDepth orders by depth then zIndex without mutating input', () => {
  const items = [
    { id: 'a', depth: 10, zIndex: 2 },
    { id: 'b', depth: 5, zIndex: 9 },
    { id: 'c', depth: 10, zIndex: 1 },
  ]
  const sorted = sortByDepth(items)
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['b', 'c', 'a'],
  )
  // 입력 불변
  assert.equal(items[0].id, 'a')
})

test('isPrimitiveClassName whitelists Rect/Line/Text/Image', () => {
  assert.equal(isPrimitiveClassName('Rect'), true)
  assert.equal(isPrimitiveClassName('Image'), true)
  assert.equal(isPrimitiveClassName('Circle'), false)
})

test('DEFAULT_CANVAS_JSON carries a schema version and grid', () => {
  assert.equal(DEFAULT_CANVAS_JSON.v, LIVE_MAP_SCHEMA_VERSION)
  assert.equal(DEFAULT_CANVAS_JSON.grid.visible, true)
  assert.ok(DEFAULT_CANVAS_JSON.width > 0)
})

const tf = (overrides: Partial<Omit<TransformJson, 'v'>>): TransformJson =>
  buildTransformJson(overrides)

test('clampScale bounds value into [MIN, MAX]', () => {
  assert.equal(clampScale(1), 1)
  assert.equal(clampScale(0), MIN_PLACEMENT_SCALE)
  assert.equal(clampScale(-3), MIN_PLACEMENT_SCALE)
  assert.equal(clampScale(99), MAX_PLACEMENT_SCALE)
})

test('scaleTransform multiplies scaleX/scaleY with clamp, leaving input untouched', () => {
  const transform = tf({ scaleX: 1, scaleY: 1 })
  const scaled = scaleTransform(transform, 1.2)
  assert.equal(scaled.scaleX.toFixed(2), '1.20')
  assert.equal(scaled.scaleY.toFixed(2), '1.20')
  // 입력 불변
  assert.equal(transform.scaleX, 1)
  // 폭주 clamp
  assert.equal(scaleTransform(transform, 1000).scaleX, MAX_PLACEMENT_SCALE)
})

test('toggleSelection replaces in single mode and toggles in additive mode', () => {
  assert.deepEqual(toggleSelection(['a', 'b'], 'c', false), ['c'])
  assert.deepEqual(toggleSelection(['a'], 'b', true), ['a', 'b'])
  assert.deepEqual(toggleSelection(['a', 'b'], 'b', true), ['a'])
})

test('liftTransformsToFront raises selected depth/zIndex above the max, leaving others intact', () => {
  const transforms = [tf({ depth: 0, zIndex: 0 }), tf({ depth: 5, zIndex: 5 }), tf({ depth: 2, zIndex: 2 })]
  const lifted = liftTransformsToFront(transforms, new Set([0]))
  assert.ok(lifted[0].depth > lifted[1].depth)
  assert.ok(lifted[0].zIndex > lifted[1].zIndex)
  // 비선택 항목 불변
  assert.equal(lifted[1].depth, 5)
  assert.equal(lifted[2].depth, 2)
  // 입력 불변
  assert.equal(transforms[0].depth, 0)
})

test('sinkTransformsToBack lowers selected depth/zIndex below the min', () => {
  const transforms = [tf({ depth: 0, zIndex: 0 }), tf({ depth: 5, zIndex: 5 })]
  const sunk = sinkTransformsToBack(transforms, new Set([1]))
  assert.ok(sunk[1].depth < sunk[0].depth)
  assert.ok(sunk[1].zIndex < sunk[0].zIndex)
  assert.equal(sunk[0].depth, 0)
})

test('DEFAULT_IMAGE_SRC is an inline data URI (no network)', () => {
  assert.ok(DEFAULT_IMAGE_SRC.startsWith('data:image/'))
  assert.equal(isPrimitiveClassName('Image'), true)
})
