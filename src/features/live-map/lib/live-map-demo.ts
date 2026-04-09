import type {
  LiveMapClusterItem,
  LiveMapDemoRunRow,
  LiveMapDemoScenarioOption,
  LiveMapDemoTargetEquipment,
  LiveMapDemoTreeNode,
  LiveMapEquipmentNode,
} from '../types/live-map.types'

const DEMO_ROW_STAGGER_TICKS = 2

const toDemoTargetEquipment = (
  equipmentNode: LiveMapEquipmentNode,
): LiveMapDemoTargetEquipment => ({
  eqpId: equipmentNode.eqpId,
  eqpName: equipmentNode.eqpName,
  lineLabel: equipmentNode.lineLabel,
  clusterId: equipmentNode.clusterId,
  clusterName: equipmentNode.clusterName,
  processingTypeLabel: equipmentNode.processingTypeLabel,
  statusLabel: equipmentNode.statusLabel,
})

export const buildLiveMapDemoTree = (
  equipmentNodes: readonly LiveMapEquipmentNode[],
  clusterItems: readonly LiveMapClusterItem[],
): LiveMapDemoTreeNode[] => {
  const lineGroups = new Map<string, LiveMapEquipmentNode[]>()

  equipmentNodes.forEach((equipmentNode) => {
    const existing = lineGroups.get(equipmentNode.lineValue)

    if (existing) {
      existing.push(equipmentNode)
      return
    }

    lineGroups.set(equipmentNode.lineValue, [equipmentNode])
  })

  return Array.from(lineGroups.entries()).map(([lineValue, lineEquipments]) => {
    const lineLabel = lineEquipments[0]?.lineLabel ?? lineValue

    return {
      id: `line:${lineValue}`,
      label: lineLabel,
      type: 'LINE',
      lineValue,
      children: clusterItems
        .filter((clusterItem) =>
          lineEquipments.some((equipmentNode) => equipmentNode.clusterId === clusterItem.id),
        )
        .map((clusterItem) => {
          const clusterEquipments = lineEquipments.filter(
            (equipmentNode) => equipmentNode.clusterId === clusterItem.id,
          )

          return {
            id: `process:${clusterItem.id}`,
            label: clusterItem.title,
            type: 'PROCESS',
            lineValue,
            clusterId: clusterItem.id,
            children: clusterEquipments.map((equipmentNode) => ({
              id: `equipment:${equipmentNode.eqpId}`,
              label: equipmentNode.eqpId,
              type: 'EQUIPMENT',
              lineValue,
              clusterId: equipmentNode.clusterId,
              eqpId: equipmentNode.eqpId,
              children: [],
            })),
          }
        }),
    }
  })
}

export const collectLiveMapDemoSelectionEquipments = (
  selectionNodeId: string | null,
  equipmentNodes: readonly LiveMapEquipmentNode[],
): LiveMapDemoTargetEquipment[] => {
  if (!selectionNodeId) {
    return []
  }

  if (selectionNodeId.startsWith('equipment:')) {
    const eqpId = selectionNodeId.replace('equipment:', '')
    const selectedEquipment = equipmentNodes.find((equipmentNode) => equipmentNode.eqpId === eqpId)

    return selectedEquipment ? [toDemoTargetEquipment(selectedEquipment)] : []
  }

  if (selectionNodeId.startsWith('process:')) {
    const clusterId = selectionNodeId.replace('process:', '')

    return equipmentNodes
      .filter((equipmentNode) => equipmentNode.clusterId === clusterId)
      .map(toDemoTargetEquipment)
  }

  if (selectionNodeId.startsWith('line:')) {
    const lineValue = selectionNodeId.replace('line:', '')

    return equipmentNodes
      .filter((equipmentNode) => equipmentNode.lineValue === lineValue)
      .map(toDemoTargetEquipment)
  }

  return []
}

export const mergeLiveMapDemoTargetEquipments = (
  currentRows: readonly LiveMapDemoTargetEquipment[],
  nextRows: readonly LiveMapDemoTargetEquipment[],
): LiveMapDemoTargetEquipment[] => {
  const mergedMap = new Map(currentRows.map((row) => [row.eqpId, row]))

  nextRows.forEach((row) => {
    if (!mergedMap.has(row.eqpId)) {
      mergedMap.set(row.eqpId, row)
    }
  })

  return Array.from(mergedMap.values())
}

export const buildLiveMapDemoRunRows = (
  targetEquipments: readonly LiveMapDemoTargetEquipment[],
  scenario: LiveMapDemoScenarioOption,
  currentTick: number,
): LiveMapDemoRunRow[] =>
  targetEquipments.map((targetEquipment, index) => {
    const startTick = index * DEMO_ROW_STAGGER_TICKS
    const elapsedTicks = Math.max(0, currentTick - startTick)
    const normalizedProgress = Math.min(elapsedTicks / scenario.durationTicks, 1)
    const progress = Math.round(normalizedProgress * 100)
    const phaseIndex =
      progress === 100
        ? scenario.phaseLabels.length - 1
        : Math.min(
            Math.floor(normalizedProgress * scenario.phaseLabels.length),
            scenario.phaseLabels.length - 1,
          )

    return {
      ...targetEquipment,
      statusText: progress === 100 ? '완료' : elapsedTicks === 0 ? '대기' : '진행 중',
      currentPhase: scenario.phaseLabels[phaseIndex] ?? scenario.phaseLabels[0] ?? '대기',
      progress,
      elapsedTicks,
    }
  })

export const isLiveMapDemoRunCompleted = (runRows: readonly LiveMapDemoRunRow[]): boolean =>
  runRows.length > 0 && runRows.every((runRow) => runRow.progress >= 100)
