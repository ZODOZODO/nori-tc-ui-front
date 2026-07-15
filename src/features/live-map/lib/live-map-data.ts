import type { LiveMapEquipmentResponse } from '../api/live-map.api'
import type { LiveMapEquipmentNode } from '../types/live-map.types'

/**
 * backend 응답 설비 목록을 보드 노드로 변환합니다.
 * 보드 배치는 canvas_json.flow 그룹이 결정하므로 좌표 없이 표시 필드만 매핑하고,
 * 카드 안 나열 순서 안정화를 위해 clusterId → eqpId 로 정렬한다.
 */
export const buildLiveMapEquipmentNodes = (
  equipmentItems: readonly LiveMapEquipmentResponse[],
): LiveMapEquipmentNode[] =>
  [...equipmentItems]
    .sort((left, right) =>
      left.clusterId === right.clusterId
        ? left.eqpId.localeCompare(right.eqpId)
        : left.clusterId.localeCompare(right.clusterId),
    )
    .map((equipment) => ({
      eqpKey: equipment.eqpKey,
      eqpId: equipment.eqpId,
      eqpName: equipment.eqpName,
      lineValue: equipment.lineValue,
      lineLabel: equipment.lineLabel,
      processingTypeLabel: equipment.equipmentModeLabel || '-',
      clusterId: equipment.clusterId,
      clusterName: equipment.clusterName,
      status: equipment.status,
      statusLabel: equipment.statusLabel,
      portItems: equipment.portItems.map((portItem) => ({
        id: portItem.id,
        label: portItem.label,
        carrierId: portItem.carrierId,
        status: portItem.status,
        statusLabel: portItem.statusLabel,
      })),
      tooltipMeta: equipment.tooltipMeta,
      tooltipStep: equipment.tooltipStep,
      alertMessage: equipment.alertMessage,
    }))
