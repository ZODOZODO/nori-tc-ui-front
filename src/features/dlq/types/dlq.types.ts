/**
 * DLQ 모니터링 페이지 사이드바 모드 키입니다.
 * `gateway` / `business` 는 Kafka 소비 실패 항목, `quarantine` 은 Gateway 격리 설비,
 * `repair-task` 는 EQP 보상 실패로 기록된 복구 과업입니다.
 */
export type DlqMode = 'gateway' | 'business' | 'quarantine' | 'repair-task'

/**
 * Gateway DLQ 엔트리 — `GET /api/dlq/gateway` 응답 단위.
 * 필드명은 `RedisDlqEntry` (`nori-tc-common`) 도메인 그대로.
 */
export interface GatewayDlqEntry {
  dlqId: string
  equipmentId: string
  traceId: string | null
  commInterfaceType: string | null
  socketType: string | null
  stage: string | null
  reasonCode: string | null
  reasonMessage: string | null
  occurredAt: number
  payloadRefKey: string | null
  rawLen: number
  b64Len: number
  tags: Record<string, string> | null
  ttlSeconds: number | null
}

/**
 * Business DLQ 엔트리 — `GET /api/dlq/business` 응답 단위.
 * 필드명은 `RedisBusinessDlqEntry` (`nori-tc-common`) 도메인 그대로.
 */
export interface BusinessDlqEntry {
  dlqId: string
  source: string | null
  stage: string | null
  topic: string | null
  partition: number | null
  offset: number | null
  eqpId: string | null
  messageType: string | null
  messageName: string | null
  reasonCode: string | null
  reasonMessage: string | null
  occurredAt: number
  payloadRef: string | null
  ttlSeconds: number | null
}

/**
 * Quarantine 엔트리 — `GET /api/dlq/quarantine` 응답 단위.
 * `quarantinedAt` 은 ISO-8601 문자열 (백엔드 `Instant` 직렬화 결과).
 */
export interface QuarantineEntry {
  equipmentId: string
  reasonCode: string | null
  reasonMessage: string | null
  quarantinedAt: string
  ttlSeconds: number | null
}

/**
 * Repair Task 엔트리 — `GET /api/dlq/repair-task` 응답 단위.
 * `repairAction` 은 백엔드 enum `name()` 문자열, `createdAt` 은 ISO-8601.
 */
export interface RepairTaskEntry {
  taskId: string
  eqpId: string
  commandType: string
  repairAction: string
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
}
