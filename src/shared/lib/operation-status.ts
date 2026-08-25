import { ApiError } from '@/shared/lib/api-error'

/**
 * operation 의 terminal 상태입니다(§13.3 / §14.2).
 *
 * **이 3 개만 terminal 판단에 씁니다.** 백엔드는 `TIMEOUT` terminal 을 만들지 않으며, 관찰 지연은
 * 상태가 아니라 {@link OperationPhase} 의 `RECONCILING` 으로만 나타납니다 — 지연을 실패로 확정하면
 * 늦게 도착한 적용이 실제 결과로 수렴할 수 없습니다.
 */
export type OperationTerminalState = 'PASS' | 'FAIL' | 'REPAIR_REQUIRED'

/**
 * operation 상태입니다.
 *
 * `(string & {})` 를 열어 두는 이유는 모르는 값을 **성공/실패로 추정하지 않기** 위함입니다(§14.2).
 * 모르는 값은 비terminal 로 취급하고 계속 조회합니다.
 */
export type OperationState = 'PENDING' | OperationTerminalState | (string & {})

/**
 * operation 의 상세 phase 입니다. 백엔드 `UiOperationPhase` 와 같은 집합입니다.
 */
export type OperationPhase =
  | 'ACCEPTED'
  | 'PREPARING'
  | 'QUIESCING'
  | 'PREPARED'
  | 'COMMITTED'
  | 'APPLYING'
  | 'FINALIZING'
  | 'BARRIER_OPEN'
  | 'RECONCILING'
  | 'COMPENSATING'
  | 'ABORTED'
  | (string & {})

/**
 * `GET /api/async/{id}` 응답 payload 입니다. 백엔드 `OperationStatusResponse` 와 같은 형태입니다.
 */
export interface OperationStatus {
  operationId: string
  eqpId: string | null
  status: OperationState
  phase: OperationPhase
  desiredRevision: number | null
  startedAt: number | null
  updatedAt: number | null
  terminalAt: number | null
  errorCode: string | null
  errorMsg: string | null
  repairReason: string | null
}

/**
 * mutation 접수(`202 Accepted`) 응답 payload 입니다. 백엔드 `OperationAcceptResponse` 와 같습니다.
 *
 * 접수는 완료가 아닙니다 — {@link OperationStatus} 를 조회해야 실제 결과를 알 수 있습니다.
 */
export interface OperationAcceptance {
  operationId: string
  status: OperationState
  phase: OperationPhase
  errorCode: string | null
  errorMsg: string | null
}

const TERMINAL_STATES: readonly OperationTerminalState[] = ['PASS', 'FAIL', 'REPAIR_REQUIRED']

/**
 * terminal 상태인지 판정합니다. 모르는 값은 terminal 이 아닙니다.
 */
export const isTerminalOperationState = (status: string): status is OperationTerminalState =>
  (TERMINAL_STATES as readonly string[]).includes(status)

/**
 * 조회를 계속해도 되는 일시적 실패인지 판정합니다.
 *
 * `503 COORDINATION_UNAVAILABLE` 은 "조정 원장을 지금 못 읽는다" 이지 "operation 이 실패했다" 가
 * 아닙니다(§13.3). 여기서 실패로 확정하면 실제로는 진행 중인 변경을 화면이 실패로 보고합니다.
 * `404` 를 포함한 나머지는 호출자에게 그대로 올립니다.
 */
const isTransientLedgerError = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 503

/**
 * polling 결과입니다. `DELAYED` 는 실패가 아니라 "아직 확인되지 않음" 입니다.
 */
export type OperationOutcome =
  | { kind: OperationTerminalState; status: OperationStatus }
  | { kind: 'DELAYED'; status: OperationStatus | null }

export interface PollOperationParams {
  /** operation 상태 조회 함수. */
  fetchStatus: (operationId: string) => Promise<OperationStatus>
  /** polling 대상 operationId(레거시 경로는 traceId). */
  operationId: string
  /** 조회 간격(ms). */
  intervalMs: number
  /** 최대 조회 횟수. 소진해도 operation 을 실패로 간주하지 않습니다. */
  maxAttempts: number
  /** 매 조회마다 현재 상태를 알립니다. 진행 phase 표시에 씁니다. */
  onProgress: (status: OperationStatus) => void
  /** 대기 함수. 테스트가 타이머 없이 돌 수 있도록 주입받습니다. */
  wait: (milliseconds: number) => Promise<void>
}

/**
 * operation 이 terminal 이 될 때까지 조회합니다(§14.1 / §14.2).
 *
 * <p>브라우저 조회 횟수를 소진해도 `DELAYED` 를 돌려줄 뿐 `FAIL` 로 바꾸지 않습니다 — Front 의
 * deadline 은 UX 용이지 operation 의 수명이 아닙니다. 모르는 status 도 비terminal 로 두고 계속
 * 조회합니다(성공·실패 추정 금지).</p>
 */
export const pollOperationUntilTerminal = async ({
  fetchStatus,
  operationId,
  intervalMs,
  maxAttempts,
  onProgress,
  wait,
}: PollOperationParams): Promise<OperationOutcome> => {
  let lastStatus: OperationStatus | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const status = await fetchStatus(operationId)
      lastStatus = status
      onProgress(status)

      if (isTerminalOperationState(status.status)) {
        return { kind: status.status, status }
      }
    } catch (error) {
      if (!isTransientLedgerError(error)) {
        throw error
      }
    }

    await wait(intervalMs)
  }

  return { kind: 'DELAYED', status: lastStatus }
}

/**
 * 브라우저 타이머 기반 대기입니다. {@link PollOperationParams.wait} 의 운영 구현입니다.
 */
export const waitWithBrowserTimer = (milliseconds: number): Promise<void> =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
