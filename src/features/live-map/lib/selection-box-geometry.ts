import * as THREE from 'three'

/** 객체 표면에 딱 붙지 않고 또렷이 감싸도록 각 축에 더하는 여유(world unit). */
export const SELECTION_BOX_INFLATE = 0.2

/**
 * 선택 강조용 와이어 박스의 모서리 geometry 를 만든다.
 *
 * `EdgesGeometry` 는 입력 geometry 의 모서리를 계산해 자기 버퍼로 **복사**하므로 재료로 쓴
 * `BoxGeometry` 를 붙들고 있을 이유가 없다. 즉시 해제하지 않으면 호출마다 GPU 버퍼가 하나씩 남는다.
 * 반환된 geometry 는 호출자가 `dispose()` 해야 한다 — r3f 는 prop 으로 주입된 geometry 를
 * 자동 해제하지 않는다(S09 D-4).
 */
export function createSelectionEdgesGeometry(
  size: readonly [number, number, number],
): THREE.EdgesGeometry {
  const box = new THREE.BoxGeometry(
    size[0] + SELECTION_BOX_INFLATE,
    size[1] + SELECTION_BOX_INFLATE,
    size[2] + SELECTION_BOX_INFLATE,
  )
  const edges = new THREE.EdgesGeometry(box)
  box.dispose()
  return edges
}
