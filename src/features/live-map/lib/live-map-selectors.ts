import type {
  LiveMapClusterSummaryMap,
  LiveMapEquipmentNode,
  LiveMapStatusFilter,
  LiveMapSummary,
} from '../types/live-map.types'

interface FilterLiveMapEquipmentNodesParams {
  lineValue: string
  statusFilter: LiveMapStatusFilter
  searchKeyword: string
}

/**
 * line / status / 검색어 기준으로 설비 노드를 필터링합니다.
 */
export const filterLiveMapEquipmentNodes = (
  equipmentNodes: readonly LiveMapEquipmentNode[],
  params: FilterLiveMapEquipmentNodesParams,
): LiveMapEquipmentNode[] => {
  const normalizedKeyword = params.searchKeyword.trim().toLowerCase()

  return equipmentNodes.filter((item) => {
    const matchesLine = params.lineValue === 'ALL' || item.lineValue === params.lineValue
    const matchesStatus = params.statusFilter === 'ALL' || item.status === params.statusFilter
    const matchesKeyword =
      normalizedKeyword.length === 0 ||
      [
        item.eqpId,
        item.eqpName,
        item.lineLabel,
        item.sectorName,
        item.clusterName,
      ].some((field) => field.toLowerCase().includes(normalizedKeyword))

    return matchesLine && matchesStatus && matchesKeyword
  })
}

/**
 * 현재 화면에 보이는 설비 기준 summary 를 계산합니다.
 */
export const summarizeLiveMapEquipmentNodes = (
  equipmentNodes: readonly LiveMapEquipmentNode[],
): LiveMapSummary =>
  equipmentNodes.reduce<LiveMapSummary>(
    (summary, item) => {
      summary.total += 1

      switch (item.status) {
        case 'RUN':
          summary.run += 1
          break
        case 'IDLE':
          summary.idle += 1
          break
        case 'ERROR':
          summary.error += 1
          break
        case 'DOWN':
          summary.down += 1
          break
      }

      return summary
    },
    {
      total: 0,
      run: 0,
      idle: 0,
      error: 0,
      down: 0,
    },
  )

/**
 * 공정 카드별 설비 상태 분포를 계산합니다.
 */
export const summarizeLiveMapEquipmentNodesByCluster = (
  equipmentNodes: readonly LiveMapEquipmentNode[],
): LiveMapClusterSummaryMap =>
  equipmentNodes.reduce<LiveMapClusterSummaryMap>((clusterSummaryMap, item) => {
    const summary = clusterSummaryMap[item.clusterId] ?? {
      total: 0,
      run: 0,
      idle: 0,
      error: 0,
      down: 0,
    }

    summary.total += 1

    switch (item.status) {
      case 'RUN':
        summary.run += 1
        break
      case 'IDLE':
        summary.idle += 1
        break
      case 'ERROR':
        summary.error += 1
        break
      case 'DOWN':
        summary.down += 1
        break
    }

    clusterSummaryMap[item.clusterId] = summary
    return clusterSummaryMap
  }, {})

/**
 * 현재 필터 기준에서 선택 설비를 안정적으로 복원합니다.
 */
export const resolveSelectedLiveMapEquipment = (
  allEquipmentNodes: readonly LiveMapEquipmentNode[],
  visibleEquipmentNodes: readonly LiveMapEquipmentNode[],
  selectedEqpId: string | null,
): LiveMapEquipmentNode | null => {
  if (selectedEqpId) {
    const selectedVisibleItem = visibleEquipmentNodes.find((item) => item.eqpId === selectedEqpId)
    if (selectedVisibleItem) {
      return selectedVisibleItem
    }
  }

  return (
    visibleEquipmentNodes.find((item) => item.status === 'ERROR') ??
    visibleEquipmentNodes[0] ??
    allEquipmentNodes.find((item) => item.status === 'ERROR') ??
    allEquipmentNodes[0] ??
    null
  )
}

/**
 * 마지막 동기화 시각을 화면 라벨 문자열로 변환합니다.
 */
export const formatLiveMapSyncLabel = (lastSyncAt: number, now: number): string => {
  const deltaMs = Math.max(0, now - lastSyncAt)
  return `${(deltaMs / 1000).toFixed(1)}s live sync`
}
