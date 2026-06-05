import { useMemo } from 'react'
import { Group, Layer, Stage } from 'react-konva'
import type { LiveMapObjectResponse } from '../api/layout.api'
import { useLayout } from '../hooks/useLayout'
import { sortByDepth } from '../lib/live-map-layout.model'
import { LIVE_MAP_BOARD_HEIGHT, LIVE_MAP_BOARD_WIDTH } from '../mocks/live-map.mock'
import { KonvaPrimitive } from './LiveMapKonvaPrimitive'

interface LiveMapStructureLayerProps {
  /** 선택 라인의 lineKey. null 이면(라인 미선택) 렌더하지 않는다. */
  lineKey: number | null
}

/**
 * 뷰어(board)의 구조물 배경 레이어입니다.
 *
 * <p>admin 이 빌더로 저작·저장한 STRUCTURE placement(벽/기둥/통로 등)를 뷰어 board 뒤에 read-only 로
 * 그린다. EQUIPMENT placement 는 뷰어의 공정 카드 그리드가 담당하므로 여기선 제외한다. board 위에
 * 깔리는 floor-plan 이라 hit-test 비활성(listening=false) + pointer-events:none 로 카드/팬 클릭을 통과시킨다.</p>
 *
 * <p>저작 좌표계가 board 좌표계(1350×710)와 동일하므로 placement transform 을 그대로 적용한다 —
 * 빌더에서 그린 위치가 뷰어 표시 위치와 1:1 로 일치한다.</p>
 */
export function LiveMapStructureLayer({ lineKey }: LiveMapStructureLayerProps) {
  const layoutQuery = useLayout(lineKey)

  const objectsByKey = useMemo(() => {
    const map = new Map<number, LiveMapObjectResponse>()
    for (const object of layoutQuery.data?.objects ?? []) {
      map.set(object.objectKey, object)
    }
    return map
  }, [layoutQuery.data?.objects])

  const structures = useMemo(() => {
    const placements = layoutQuery.data?.placements ?? []
    const resolved = placements
      .map((placement) => {
        const object = objectsByKey.get(placement.objectKey)
        if (!object || object.objectKind !== 'STRUCTURE') {
          return null
        }
        return {
          placementKey: placement.placementKey,
          object,
          transform: placement.transformJson,
          depth: placement.transformJson.depth,
          zIndex: placement.transformJson.zIndex,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
    return sortByDepth(resolved)
  }, [layoutQuery.data?.placements, objectsByKey])

  if (lineKey === null || structures.length === 0) {
    return null
  }

  return (
    <div data-testid="live-map-structure-layer" className="pointer-events-none absolute inset-0">
      <Stage width={LIVE_MAP_BOARD_WIDTH} height={LIVE_MAP_BOARD_HEIGHT} listening={false}>
        <Layer listening={false}>
          {structures.map((structure) => (
            <Group
              key={structure.placementKey}
              x={structure.transform.x}
              y={structure.transform.y}
              rotation={structure.transform.rotation}
              scaleX={structure.transform.scaleX}
              scaleY={structure.transform.scaleY}
              skewX={structure.transform.skewX}
              skewY={structure.transform.skewY}
            >
              {(structure.object.shapeJson.root.children ?? []).map((child, index) => (
                <KonvaPrimitive key={`${structure.placementKey}-${index}`} node={child} />
              ))}
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
