import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/i18n/i18n-context'
import { operationApi } from '@/shared/api/operation.api'
import { useAsyncCommandGuard } from '@/shared/hooks/useAsyncCommandGuard'
import {
  pollOperationUntilTerminal,
  waitWithBrowserTimer,
  type OperationOutcome,
  type OperationPhase,
} from '@/shared/lib/operation-status'
import {
  forgetPendingOperation,
  readPendingOperation,
  rememberPendingOperation,
} from '@/shared/lib/pending-operation-store'
import { resolveErrorMessage } from '@/shared/lib/resolve-error-message'
import type { EqpCreateRequest, EqpUpdateRequest } from '../types/eqp.types'
import type { EqpOperationResultStatus } from '../lib/eqp-operation-result-presentation'
import type { useEqpMutations } from './useEqpMutations'

const OPERATION_POLL_INTERVAL_MS = 1000
const OPERATION_MAX_ATTEMPTS = 60
const PENDING_OPERATION_SCOPE = 'eqp-mutation'

export type EqpMutationAction = 'create' | 'update' | 'delete'

const MUTATION_ACTIONS: readonly EqpMutationAction[] = ['create', 'update', 'delete']

const isMutationAction = (value: string): value is EqpMutationAction =>
  (MUTATION_ACTIONS as readonly string[]).includes(value)

export interface EqpMutationResultDialogState {
  open: boolean
  status: EqpOperationResultStatus
  action: EqpMutationAction
  eqpId: string | null
  message: string | null
  /** 재조회 대상. `delayed` 일 때 수동 재조회에 쓴다. */
  operationId: string | null
}

const EMPTY_RESULT_DIALOG_STATE: EqpMutationResultDialogState = {
  open: false,
  status: 'success',
  action: 'create',
  eqpId: null,
  message: null,
  operationId: null,
}

type EqpMutations = ReturnType<typeof useEqpMutations>

interface UseEqpMutationCommandsParams {
  createEqpMutation: EqpMutations['createEqpMutation']
  updateEqpMutation: EqpMutations['updateEqpMutation']
  deleteEqpMutation: EqpMutations['deleteEqpMutation']
  invalidateAfterOperationPass: EqpMutations['invalidateAfterOperationPass']
  invalidateAfterEqpDeletePass: EqpMutations['invalidateAfterEqpDeletePass']
  /**
   * operation 이 terminal(또는 확인 지연)로 확정된 뒤 호출된다 — 입력 다이얼로그를 닫고 화면
   * 선택 상태를 정리하는 지점이다. 접수 시점이 아니다(접수 ≠ 완료).
   */
  onTerminal: (action: EqpMutationAction, eqpId: string, passed: boolean) => void
}

interface UseEqpMutationCommandsResult {
  resultDialog: EqpMutationResultDialogState
  /** 진행 중 operation 의 현재 phase. 접수 이후 진행 표시에 쓴다. */
  operationPhase: OperationPhase | null
  /** 접수 발행부터 폴링 구간까지 true. */
  isMutationPending: boolean
  /** 접수 자체가 거부된 경우의 폼 오류 메시지(409/503 등). */
  acceptanceErrorMessage: string | null
  /** 입력 다이얼로그를 닫을 때 호출한다 — 다시 열었을 때 직전 거부 사유가 남지 않도록. */
  clearAcceptanceError(): void
  closeResultDialog(): void
  recheckOperation(): Promise<void>
  submitCreate(request: EqpCreateRequest): Promise<void>
  submitUpdate(eqpId: string, request: EqpUpdateRequest): Promise<void>
  submitDelete(eqpId: string): Promise<void>
}

/**
 * 설비 create / update / delete 를 **접수 → 진행 → terminal** 3 구간으로 다룹니다(§14.1).
 *
 * <p>이 명령들은 `202 Accepted` 로 settle 한다 — 접수 시점에 "변경 완료" 를 표시하지 않고,
 * `operationId` 로 operation 을 조회해 PASS 를 받은 뒤에야 성공 메시지와 캐시 무효화를 수행한다.
 * 조회 횟수를 소진해도 실패로 확정하지 않고 `delayed` 로 표시하며, 사용자가 직접 재조회할 수
 * 있게 `operationId` 를 보존한다(§14.2).</p>
 */
export function useEqpMutationCommands({
  createEqpMutation,
  updateEqpMutation,
  deleteEqpMutation,
  invalidateAfterOperationPass,
  invalidateAfterEqpDeletePass,
  onTerminal,
}: UseEqpMutationCommandsParams): UseEqpMutationCommandsResult {
  const { t } = useI18n()

  const [resultDialog, setResultDialog] =
    useState<EqpMutationResultDialogState>(EMPTY_RESULT_DIALOG_STATE)
  const [operationPhase, setOperationPhase] = useState<OperationPhase | null>(null)
  const [acceptanceErrorMessage, setAcceptanceErrorMessage] = useState<string | null>(null)
  const mutationGuard = useAsyncCommandGuard()

  const clearAcceptanceError = useCallback(() => setAcceptanceErrorMessage(null), [])

  const closeResultDialog = useCallback(() => {
    // 사용자가 결과를 닫으면 복원 대상에서 뺀다 — 그러지 않으면 확인 지연 기록이 terminal 을
    // 관측할 때까지 새로고침마다 다시 열린다.
    forgetPendingOperation(PENDING_OPERATION_SCOPE)
    // Radix Dialog 의 close 애니메이션 동안 직전 status/message 가 유지돼야 한다 — 전체를 초기화하면
    // status 기본값(success)이 잠깐 노출돼 실패 → 정상 팝업이 깜빡인다.
    setResultDialog((previous) => ({ ...previous, open: false }))
  }, [])

  const trackOperation = useCallback(
    (operationId: string): Promise<OperationOutcome> =>
      pollOperationUntilTerminal({
        fetchStatus: operationApi.getOperationStatus,
        operationId,
        intervalMs: OPERATION_POLL_INTERVAL_MS,
        maxAttempts: OPERATION_MAX_ATTEMPTS,
        onProgress: (status) => setOperationPhase(status.phase),
        wait: waitWithBrowserTimer,
      }),
    [],
  )

  const applyOutcome = useCallback(
    async (outcome: OperationOutcome, action: EqpMutationAction, eqpId: string) => {
      onTerminal(action, eqpId, outcome.kind === 'PASS')

      // terminal 을 실제로 관측했을 때만 재조회 좌표를 버린다 — `DELAYED` 는 operation 의 종료가
      // 아니라 "아직 확인되지 않음" 이므로 새로고침 후에도 조회할 수 있어야 한다(§14.1).
      if (outcome.kind !== 'DELAYED') {
        forgetPendingOperation(PENDING_OPERATION_SCOPE)
      }

      if (outcome.kind === 'PASS') {
        if (action === 'delete') {
          await invalidateAfterEqpDeletePass(eqpId)
        } else {
          await invalidateAfterOperationPass(eqpId)
        }
        setResultDialog({
          open: true,
          status: 'success',
          action,
          eqpId,
          message: null,
          operationId: outcome.status.operationId,
        })
        return
      }

      if (outcome.kind === 'REPAIR_REQUIRED') {
        setResultDialog({
          open: true,
          status: 'repair',
          action,
          eqpId,
          message: outcome.status.repairReason ?? outcome.status.errorMsg,
          operationId: outcome.status.operationId,
        })
        return
      }

      if (outcome.kind === 'DELAYED') {
        setResultDialog({
          open: true,
          status: 'delayed',
          action,
          eqpId,
          message: null,
          operationId: outcome.status?.operationId ?? null,
        })
        return
      }

      setResultDialog({
        open: true,
        status: 'failure',
        action,
        eqpId,
        message: outcome.status.errorMsg,
        operationId: outcome.status.operationId,
      })
    },
    [invalidateAfterEqpDeletePass, invalidateAfterOperationPass, onTerminal],
  )

  /**
   * 접수 → 추적을 한 흐름으로 실행한다.
   *
   * 접수 자체의 거부(409 RESOURCE_BUSY / IDEMPOTENCY_CONFLICT / REVISION_CONFLICT,
   * 503 COORDINATION_UNAVAILABLE)는 **폼 오류**로 남긴다 — 아직 operation 이 없으므로 결과
   * 다이얼로그를 열 수 없다. 추적 중의 실패만 결과 다이얼로그로 간다.
   */
  const runOperation = useCallback(
    async (
      action: EqpMutationAction,
      eqpId: string,
      accept: () => Promise<{ operationId: string }>,
      acceptFallbackMessage: string,
    ) => {
      await mutationGuard.run(async () => {
        setAcceptanceErrorMessage(null)
        setOperationPhase(null)

        let operationId: string
        try {
          operationId = (await accept()).operationId
        } catch (error) {
          setAcceptanceErrorMessage(resolveErrorMessage(error, acceptFallbackMessage))
          return
        }

        rememberPendingOperation(PENDING_OPERATION_SCOPE, { operationId, action, eqpId })

        try {
          await applyOutcome(await trackOperation(operationId), action, eqpId)
        } catch (error) {
          onTerminal(action, eqpId, false)
          setResultDialog({
            open: true,
            status: 'failure',
            action,
            eqpId,
            message: resolveErrorMessage(error, acceptFallbackMessage),
            operationId,
          })
        }
      })
    },
    [applyOutcome, mutationGuard, onTerminal, trackOperation],
  )

  const submitCreate = useCallback(
    (request: EqpCreateRequest) =>
      runOperation(
        'create',
        request.eqpId,
        () => createEqpMutation.mutateAsync(request),
        t('error.eqp.create'),
      ),
    [createEqpMutation, runOperation, t],
  )

  const submitUpdate = useCallback(
    (eqpId: string, request: EqpUpdateRequest) =>
      runOperation(
        'update',
        eqpId,
        () => updateEqpMutation.mutateAsync({ eqpId, request }),
        t('error.eqp.update'),
      ),
    [runOperation, t, updateEqpMutation],
  )

  const submitDelete = useCallback(
    (eqpId: string) =>
      runOperation(
        'delete',
        eqpId,
        () => deleteEqpMutation.mutateAsync({ eqpId }),
        t('error.eqp.delete'),
      ),
    [deleteEqpMutation, runOperation, t],
  )

  const recheckOperation = useCallback(async () => {
    const { operationId, action, eqpId } = resultDialog
    if (!operationId || !eqpId) {
      return
    }

    await mutationGuard.run(async () => {
      try {
        await applyOutcome(await trackOperation(operationId), action, eqpId)
      } catch (error) {
        setResultDialog((previous) => ({
          ...previous,
          status: 'failure',
          message: resolveErrorMessage(error, t('error.eqp.asyncResult')),
        }))
      }
    })
  }, [applyOutcome, mutationGuard, resultDialog, t, trackOperation])

  // 새로고침으로 화면 상태가 사라져도 진행 중 operation 을 다시 조회할 수 있어야 한다(§14.1).
  // 접수 시 남긴 좌표를 "확인 지연" 결과로 복원해 기존 재조회 경로에 연결한다.
  useEffect(() => {
    const pending = readPendingOperation(PENDING_OPERATION_SCOPE)
    if (pending === null) {
      return
    }
    if (!isMutationAction(pending.action)) {
      forgetPendingOperation(PENDING_OPERATION_SCOPE)
      return
    }

    setResultDialog({
      open: true,
      status: 'delayed',
      action: pending.action,
      eqpId: pending.eqpId,
      message: null,
      operationId: pending.operationId,
    })
  }, [])

  const isMutationPending =
    mutationGuard.isRunning ||
    createEqpMutation.isPending ||
    updateEqpMutation.isPending ||
    deleteEqpMutation.isPending

  return {
    resultDialog,
    operationPhase,
    isMutationPending,
    acceptanceErrorMessage,
    clearAcceptanceError,
    closeResultDialog,
    recheckOperation,
    submitCreate,
    submitUpdate,
    submitDelete,
  }
}
