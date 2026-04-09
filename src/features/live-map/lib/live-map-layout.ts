import type {
  LiveMapClusterItem,
  LiveMapClusterPositionDrafts,
  LiveMapEquipmentNode,
  LiveMapEquipmentPositionDrafts,
  LiveMapPoint,
} from '../types/live-map.types'

export const LIVE_MAP_MACHINE_NODE_WIDTH = 28
export const LIVE_MAP_MACHINE_NODE_HEIGHT = 40

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/**
 * 폭/높이를 가진 노드가 보드 바깥으로 나가지 않도록 좌표를 보정합니다.
 */
export const clampLiveMapRectPosition = (
  position: LiveMapPoint,
  width: number,
  height: number,
  boardWidth: number,
  boardHeight: number,
): LiveMapPoint => ({
  x: clamp(
    Math.round(position.x),
    0,
    Math.max(0, boardWidth - width),
  ),
  y: clamp(
    Math.round(position.y),
    0,
    Math.max(0, boardHeight - height),
  ),
})

/**
 * drag 중 계산된 좌표가 보드 범위를 벗어나지 않도록 보정합니다.
 */
export const clampLiveMapEquipmentPosition = (
  position: LiveMapPoint,
  boardWidth: number,
  boardHeight: number,
): LiveMapPoint =>
  clampLiveMapRectPosition(
    position,
    LIVE_MAP_MACHINE_NODE_WIDTH,
    LIVE_MAP_MACHINE_NODE_HEIGHT,
    boardWidth,
    boardHeight,
  )

/**
 * 사용자가 옮긴 draft 좌표를 기본 mock 공정 카드 좌표에 합성합니다.
 */
export const applyLiveMapClusterPositionDrafts = (
  clusterItems: readonly LiveMapClusterItem[],
  positionDrafts: LiveMapClusterPositionDrafts,
): LiveMapClusterItem[] =>
  clusterItems.map((clusterItem) => {
    const positionDraft = positionDrafts[clusterItem.id]

    if (!positionDraft) {
      return clusterItem
    }

    return {
      ...clusterItem,
      x: positionDraft.x,
      y: positionDraft.y,
    }
  })

/**
 * 사용자가 옮긴 draft 좌표를 기본 mock 설비 좌표에 합성합니다.
 */
export const applyLiveMapEquipmentPositionDrafts = (
  equipmentNodes: readonly LiveMapEquipmentNode[],
  positionDrafts: LiveMapEquipmentPositionDrafts,
): LiveMapEquipmentNode[] =>
  equipmentNodes.map((equipmentNode) => {
    const positionDraft = positionDrafts[equipmentNode.eqpId]

    if (!positionDraft) {
      return equipmentNode
    }

    return {
      ...equipmentNode,
      x: positionDraft.x,
      y: positionDraft.y,
    }
  })
