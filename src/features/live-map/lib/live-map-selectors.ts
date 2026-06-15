import type {
  LiveMapEquipmentNode,
  LiveMapStatusFilter,
  LiveMapSummary,
} from '../types/live-map.types'

/** 라인 스코프 필터에서 전체 라인을 의미하는 값입니다. */
export const LIVE_MAP_ALL_LINES = 'ALL'

interface FilterLiveMapEquipmentNodesParams {
  statusFilter: LiveMapStatusFilter
  searchKeyword: string
  /** 선택된 라인 스코프(line_code). 'ALL' 이면 전체 라인. 미지정 시 전체. */
  lineFilter?: string
}

/**
 * 라인 스코프 / status / 검색어 기준으로 설비 노드를 필터링합니다.
 */
export const filterLiveMapEquipmentNodes = (
  equipmentNodes: readonly LiveMapEquipmentNode[],
  params: FilterLiveMapEquipmentNodesParams,
): LiveMapEquipmentNode[] => {
  const normalizedKeyword = params.searchKeyword.trim().toLowerCase()
  const lineFilter = params.lineFilter ?? LIVE_MAP_ALL_LINES

  return equipmentNodes.filter((item) => {
    const matchesLine = lineFilter === LIVE_MAP_ALL_LINES || item.lineValue === lineFilter
    const matchesStatus = params.statusFilter === 'ALL' || item.status === params.statusFilter
    const matchesKeyword =
      normalizedKeyword.length === 0 ||
      [
        item.eqpId,
        item.eqpName,
        item.lineLabel,
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
 * 현재 필터(라인 스코프 포함) 기준에서 선택 설비를 복원합니다.
 *
 * visible 가 비면 null 을 반환한다 — 전체 라인으로 폴백하면 설비 없는 라인 스코프에
 * 타 라인 설비가 '선택 설비'로 누수되므로 visible 밖으로는 절대 넘어가지 않는다.
 */
export const resolveSelectedLiveMapEquipment = (
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
    null
  )
}

/**
 * 마지막 동기화 시각을 화면 라벨 문자열로 변환합니다.
 */
export const formatLiveMapSyncLabel = (lastSyncAt: number, now: number): string => {
  const deltaMs = Math.max(0, now - lastSyncAt)
  return `${(deltaMs / 1000).toFixed(1)}s`
}
