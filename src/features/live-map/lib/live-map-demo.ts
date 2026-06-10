import type {
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

/**
 * 라인 → 공정(설비의 clusterId/clusterName) → 설비 계층 트리를 만듭니다.
 * 공정 노드는 설비 데이터에서 직접 파생(첫 등장 순) — 별도 공정 카탈로그에 의존하지 않는다.
 */
export const buildLiveMapDemoTree = (
  equipmentNodes: readonly LiveMapEquipmentNode[],
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
    const clusterGroups = new Map<string, LiveMapEquipmentNode[]>()

    lineEquipments.forEach((equipmentNode) => {
      const existing = clusterGroups.get(equipmentNode.clusterId)

      if (existing) {
        existing.push(equipmentNode)
        return
      }

      clusterGroups.set(equipmentNode.clusterId, [equipmentNode])
    })

    return {
      id: `line:${lineValue}`,
      label: lineLabel,
      type: 'LINE',
      lineValue,
      children: Array.from(clusterGroups.entries()).map(([clusterId, clusterEquipments]) => ({
        id: `process:${clusterId}`,
        label: clusterEquipments[0]?.clusterName ?? clusterId,
        type: 'PROCESS',
        lineValue,
        clusterId,
        children: clusterEquipments.map((equipmentNode) => ({
          id: `equipment:${equipmentNode.eqpId}`,
          label: equipmentNode.eqpId,
          type: 'EQUIPMENT',
          lineValue,
          clusterId: equipmentNode.clusterId,
          eqpId: equipmentNode.eqpId,
          eqpName: equipmentNode.eqpName,
          children: [],
        })),
      })),
    }
  })
}

export const collectLiveMapDemoEquipmentsByEqpIds = (
  eqpIds: readonly string[],
  equipmentNodes: readonly LiveMapEquipmentNode[],
): LiveMapDemoTargetEquipment[] => {
  if (eqpIds.length === 0) {
    return []
  }

  const wantedEqpIds = new Set(eqpIds)

  return equipmentNodes
    .filter((equipmentNode) => wantedEqpIds.has(equipmentNode.eqpId))
    .map(toDemoTargetEquipment)
}

export const collectLiveMapDemoTreeEqpIds = (node: LiveMapDemoTreeNode): string[] => {
  if (node.type === 'EQUIPMENT') {
    return node.eqpId ? [node.eqpId] : []
  }

  return node.children.flatMap((childNode) => collectLiveMapDemoTreeEqpIds(childNode))
}

export const filterLiveMapDemoTree = (
  nodes: readonly LiveMapDemoTreeNode[],
  searchKeyword: string,
): LiveMapDemoTreeNode[] => {
  const normalizedKeyword = searchKeyword.trim().toLowerCase()

  if (normalizedKeyword === '') {
    return nodes.map((node) => ({ ...node, children: filterLiveMapDemoTree(node.children, '') }))
  }

  const matchedNodes: LiveMapDemoTreeNode[] = []

  nodes.forEach((node) => {
    if (node.type === 'EQUIPMENT') {
      const eqpIdMatched = node.label.toLowerCase().includes(normalizedKeyword)
      const eqpNameMatched = (node.eqpName ?? '').toLowerCase().includes(normalizedKeyword)

      if (eqpIdMatched || eqpNameMatched) {
        matchedNodes.push({ ...node, children: [] })
      }
      return
    }

    const filteredChildren = filterLiveMapDemoTree(node.children, searchKeyword)

    if (filteredChildren.length > 0) {
      matchedNodes.push({ ...node, children: filteredChildren })
    }
  })

  return matchedNodes
}

export const collectLiveMapDemoExpandableNodeIds = (
  nodes: readonly LiveMapDemoTreeNode[],
): string[] => {
  const ids: string[] = []

  nodes.forEach((node) => {
    if (node.children.length === 0) {
      return
    }

    ids.push(node.id)
    ids.push(...collectLiveMapDemoExpandableNodeIds(node.children))
  })

  return ids
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
      // eslint-disable-next-line i18next/no-literal-string -- 데모 시나리오 상태 텍스트: 제품 미렌더(테스트 전용), 사용자 비노출이라 번역 비대상
      statusText: progress === 100 ? '완료' : elapsedTicks === 0 ? '대기' : '진행 중',
      // eslint-disable-next-line i18next/no-literal-string -- 위와 동일(데모 전용, 사용자 비노출)
      currentPhase: scenario.phaseLabels[phaseIndex] ?? scenario.phaseLabels[0] ?? '대기',
      progress,
      elapsedTicks,
    }
  })
