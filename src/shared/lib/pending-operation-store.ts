/**
 * 아직 terminal 이 확인되지 않은 operation 의 재조회 좌표를 브라우저에 남깁니다(§14.1).
 *
 * <p>`operationId` 를 화면 상태에만 두면 새로고침 한 번으로 재조회 수단이 사라진다 — backend
 * operation 은 살아 있는데 화면은 그것을 가리킬 식별자를 잃고, 사용자는 결과를 확인할 방법이
 * 없어 같은 변경을 다시 요청한다. §14.1 은 "페이지 새로고침 후 operationId 로 상태를 다시
 * 조회할 수 있어야 한다" 를 요구한다.</p>
 *
 * <p>terminal 을 실제로 관측한 시점에만 지운다. 조회 소진(`DELAYED`)이나 조회 실패는 operation 의
 * 종료가 아니므로 기록을 유지한다.</p>
 */

const STORAGE_KEY = 'tc.pending-operations.v1'

/** 기록 구획. 명령 계열마다 진행 중 operation 이 하나씩 있을 수 있다. */
export type PendingOperationScope = 'eqp-mutation' | 'eqp-lifecycle'

export interface PendingOperationRecord {
  operationId: string
  /** 계열별 action 문자열. 복원 시 해당 훅이 자신의 union 으로 좁힌다. */
  action: string
  eqpId: string
}

type PendingOperationMap = Partial<Record<PendingOperationScope, PendingOperationRecord>>

const isRecord = (value: unknown): value is PendingOperationRecord => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.operationId === 'string' &&
    candidate.operationId.length > 0 &&
    typeof candidate.action === 'string' &&
    typeof candidate.eqpId === 'string'
  )
}

/**
 * 저장소 접근은 시스템 경계다 — private 모드/차단 설정에서 접근 자체가 throw 하고, 값은 다른
 * 탭이나 이전 버전이 쓴 임의 문자열일 수 있다.
 */
const readAll = (): PendingOperationMap => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return {}
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return {}
    }
    return parsed as PendingOperationMap
  } catch {
    return {}
  }
}

const writeAll = (records: PendingOperationMap): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // 저장에 실패해도 진행 중 명령을 막지 않는다 — 재조회 편의를 잃을 뿐이다.
  }
}

export const readPendingOperation = (scope: PendingOperationScope): PendingOperationRecord | null => {
  const stored = readAll()[scope]
  return isRecord(stored) ? stored : null
}

export const rememberPendingOperation = (
  scope: PendingOperationScope,
  record: PendingOperationRecord,
): void => {
  writeAll({ ...readAll(), [scope]: record })
}

export const forgetPendingOperation = (scope: PendingOperationScope): void => {
  const records = readAll()
  delete records[scope]
  writeAll(records)
}
