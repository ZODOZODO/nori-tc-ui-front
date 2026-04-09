import type { LiveMapEquipmentResponse } from '../api/live-map.api'
import type { LiveMapClusterItem, LiveMapEquipmentNode, LiveMapEqpProcessingType } from '../types/live-map.types'

const LIVE_MAP_CLUSTER_FALLBACK_ID = 'etc'
const LIVE_MAP_GRID_COLUMNS = 5
const LIVE_MAP_NODE_OFFSET_X = 22
const LIVE_MAP_NODE_OFFSET_Y = 92
const LIVE_MAP_NODE_GAP_X = 38
const LIVE_MAP_NODE_GAP_Y = 60

const DEFAULT_EQUIPMENT_PROCESSING_TYPE: LiveMapEqpProcessingType = 'SINGLE'

/**
 * backend 응답 설비 목록을 공정 카드 기준 보드 노드로 변환합니다.
 */
export const buildLiveMapEquipmentNodes = (
  equipmentItems: readonly LiveMapEquipmentResponse[],
  clusters: readonly LiveMapClusterItem[],
): LiveMapEquipmentNode[] => {
  const clusterIndex = new Map(
    clusters.map((cluster) => [cluster.id, cluster]),
  )
  const clusterSlotMap = new Map<string, number>()

  return [...equipmentItems]
    .sort((left, right) =>
      left.clusterId === right.clusterId
        ? left.eqpId.localeCompare(right.eqpId)
        : left.clusterId.localeCompare(right.clusterId),
    )
    .map((equipment) => {
      const resolvedClusterId = clusterIndex.has(equipment.clusterId)
        ? equipment.clusterId
        : LIVE_MAP_CLUSTER_FALLBACK_ID
      const cluster = clusterIndex.get(resolvedClusterId)

      if (!cluster) {
        throw new Error(`LIVE_MAP_CLUSTER_ITEMS 위치 정보를 찾을 수 없습니다: ${resolvedClusterId}`)
      }

      const slotIndex = clusterSlotMap.get(resolvedClusterId) ?? 0
      clusterSlotMap.set(resolvedClusterId, slotIndex + 1)

      const columnIndex = slotIndex % LIVE_MAP_GRID_COLUMNS
      const rowIndex = Math.floor(slotIndex / LIVE_MAP_GRID_COLUMNS)

      return {
        eqpId: equipment.eqpId,
        eqpName: equipment.eqpName,
        lineValue: equipment.lineValue,
        lineLabel: equipment.lineLabel,
        processingType: DEFAULT_EQUIPMENT_PROCESSING_TYPE,
        processingTypeLabel: equipment.equipmentModeLabel || '-',
        clusterId: resolvedClusterId,
        clusterName: equipment.clusterName,
        sectorId: resolvedClusterId,
        sectorName: equipment.clusterName,
        status: equipment.status,
        statusLabel: equipment.statusLabel,
        x: cluster.x + LIVE_MAP_NODE_OFFSET_X + columnIndex * LIVE_MAP_NODE_GAP_X,
        y: cluster.y + LIVE_MAP_NODE_OFFSET_Y + rowIndex * LIVE_MAP_NODE_GAP_Y,
        portItems: equipment.portItems.map((portItem) => ({
          id: portItem.id,
          label: portItem.label,
          status: portItem.status,
          statusLabel: portItem.statusLabel,
        })),
        tooltipMeta: equipment.tooltipMeta,
        tooltipStep: equipment.tooltipStep,
        alertMessage: equipment.alertMessage,
      }
    })
}
