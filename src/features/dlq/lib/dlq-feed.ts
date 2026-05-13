import type {
  BusinessDlqEntry,
  GatewayDlqEntry,
  QuarantineEntry,
  RepairTaskEntry,
} from '../types/dlq.types'

/**
 * 장애 대시보드 통합 피드의 최대 표시 건수. 4 카테고리를 합쳐 시간 역순 상위 N건.
 */
export const FEED_LIMIT = 20

/**
 * 통합 피드 row 의 카테고리 discriminator.
 */
export type DashboardCategory = 'gateway' | 'business' | 'quarantine' | 'repair-task'

/**
 * 4 카테고리 entry 를 epoch millis 기준으로 정규화한 통합 피드 row.
 * `equipmentId` 는 nullable — Business DLQ 의 `eqpId` 가 null 가능하기 때문.
 */
export interface DashboardFeedItem {
  id: string
  category: DashboardCategory
  timestamp: number
  equipmentId: string | null
  reasonCode: string | null
  reasonMessage: string | null
}

export const mapGatewayToFeed = (entry: GatewayDlqEntry): DashboardFeedItem => ({
  id: `gw:${entry.dlqId}`,
  category: 'gateway',
  timestamp: entry.occurredAt,
  equipmentId: entry.equipmentId,
  reasonCode: entry.reasonCode,
  reasonMessage: entry.reasonMessage,
})

export const mapBusinessToFeed = (entry: BusinessDlqEntry): DashboardFeedItem => ({
  id: `bz:${entry.dlqId}`,
  category: 'business',
  timestamp: entry.occurredAt,
  equipmentId: entry.eqpId,
  reasonCode: entry.reasonCode,
  reasonMessage: entry.reasonMessage,
})

export const mapQuarantineToFeed = (entry: QuarantineEntry): DashboardFeedItem => ({
  id: `qt:${entry.equipmentId}`,
  category: 'quarantine',
  timestamp: Date.parse(entry.quarantinedAt),
  equipmentId: entry.equipmentId,
  reasonCode: entry.reasonCode,
  reasonMessage: entry.reasonMessage,
})

export const mapRepairTaskToFeed = (entry: RepairTaskEntry): DashboardFeedItem => ({
  id: `rt:${entry.taskId}`,
  category: 'repair-task',
  timestamp: Date.parse(entry.createdAt),
  equipmentId: entry.eqpId,
  reasonCode: entry.errorCode,
  reasonMessage: entry.errorMessage,
})

/**
 * 4 카테고리 배열을 합쳐 timestamp 내림차순 정렬 후 FEED_LIMIT 건으로 자른다.
 * `Date.parse` 가 NaN 을 반환한 invalid 항목은 정렬 불안정을 막기 위해 제외한다.
 */
export const buildDashboardFeed = (
  gateway: ReadonlyArray<GatewayDlqEntry>,
  business: ReadonlyArray<BusinessDlqEntry>,
  quarantine: ReadonlyArray<QuarantineEntry>,
  repairTask: ReadonlyArray<RepairTaskEntry>,
): DashboardFeedItem[] => {
  const merged: DashboardFeedItem[] = [
    ...gateway.map(mapGatewayToFeed),
    ...business.map(mapBusinessToFeed),
    ...quarantine.map(mapQuarantineToFeed),
    ...repairTask.map(mapRepairTaskToFeed),
  ].filter((item) => !Number.isNaN(item.timestamp))

  merged.sort((left, right) => right.timestamp - left.timestamp)
  return merged.slice(0, FEED_LIMIT)
}
