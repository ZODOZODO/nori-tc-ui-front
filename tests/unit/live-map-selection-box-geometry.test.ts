import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import {
  SELECTION_BOX_INFLATE,
  createSelectionEdgesGeometry,
} from '@/features/live-map/lib/selection-box-geometry.ts'

/**
 * S09 D-4 재현 — 구조물 선택 박스의 `EdgesGeometry` 누수.
 *
 * 결함 당시 `SelectionBox` 는 `useMemo(..., [size])` 로 geometry 를 만들었고 호출부(`:378`)가
 * 매 렌더 새 배열 리터럴(`[bbox.size.x, ...]`)을 넘겨 memo 가 매번 무효화됐다. 게다가 r3f 는
 * prop 으로 주입된 geometry 를 자동 dispose 하지 않으므로 `EdgesGeometry` 와 그 안의 임시
 * `BoxGeometry` 가 프레임마다 GPU 버퍼로 쌓였다 → 장시간 편집 세션에서 WebGL context lost.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('임시 BoxGeometry 는 EdgesGeometry 생성 직후 해제된다', () => {
  const originalDispose = THREE.BoxGeometry.prototype.dispose
  let boxDisposeCount = 0
  THREE.BoxGeometry.prototype.dispose = function disposeSpy(this: THREE.BoxGeometry) {
    boxDisposeCount += 1
    originalDispose.call(this)
  }

  try {
    const edges = createSelectionEdgesGeometry([2, 3, 4])
    assert.equal(boxDisposeCount, 1, 'EdgesGeometry 는 데이터를 복사하므로 임시 box 를 남길 이유가 없다')
    edges.dispose()
  } finally {
    THREE.BoxGeometry.prototype.dispose = originalDispose
  }
})

test('선택 박스는 대상 크기를 SELECTION_BOX_INFLATE 만큼 부풀린다', () => {
  const edges = createSelectionEdgesGeometry([2, 3, 4])
  edges.computeBoundingBox()
  const bounds = edges.boundingBox
  assert.ok(bounds)

  const width = bounds.max.x - bounds.min.x
  const height = bounds.max.y - bounds.min.y
  const depth = bounds.max.z - bounds.min.z

  assert.equal(Number(width.toFixed(5)), 2 + SELECTION_BOX_INFLATE)
  assert.equal(Number(height.toFixed(5)), 3 + SELECTION_BOX_INFLATE)
  assert.equal(Number(depth.toFixed(5)), 4 + SELECTION_BOX_INFLATE)
  edges.dispose()
})

/**
 * 배선 회귀망 — LiveMap3DScene 은 1386 LOC 이고 이 인프라에 jsdom/RTL 이 없어 mount 검증이 불가하다
 * (`use-dcop-item-picker-state.test.ts` 와 같은 제약). D-4 가 지목한 두 지점을 소스 수준으로 고정한다.
 */
test('SelectionBox 의 memo 는 배열 identity 가 아니라 치수에 의존하고 geometry 를 해제한다', () => {
  const source = readFileSync(
    join(ROOT, 'src/features/live-map/components/LiveMap3DScene.tsx'),
    'utf8',
  )
  // CRLF 개행이므로 `\r?` 를 넣지 않으면 함수 끝 경계를 못 잡는다.
  const selectionBox = /function SelectionBox\(\{[\s\S]*?\r?\n\}\r?\n/.exec(source)
  assert.ok(selectionBox, 'SelectionBox 정의를 찾지 못했다')
  const body = selectionBox[0]

  assert.doesNotMatch(
    body,
    /useMemo\([\s\S]*?\[size\],/,
    'D-4 회귀: memo 가 매 렌더 새로 만들어지는 size 배열 identity 에 의존한다',
  )
  assert.match(
    body,
    /createSelectionEdgesGeometry/,
    'D-4 회귀: 임시 BoxGeometry 를 해제하는 헬퍼를 경유하지 않는다',
  )
  assert.match(body, /edges\.dispose\(\)/, 'D-4 회귀: EdgesGeometry cleanup 이 없다')
})
