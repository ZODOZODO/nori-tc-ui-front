import { useCallback, useState } from 'react'
import { useI18n } from '@/i18n/i18n-context'
import { useAsyncCommandGuard } from '@/shared/hooks/useAsyncCommandGuard'
import { operationApi } from '@/shared/api/operation.api'
import {
  pollOperationUntilTerminal,
  waitWithBrowserTimer,
  type OperationOutcome,
  type OperationPhase,
} from '@/shared/lib/operation-status'
import { resolveErrorMessage } from '@/shared/lib/resolve-error-message'
import type { EqpOperationResultStatus } from '../lib/eqp-operation-result-presentation'
import type { EqpInfo } from '../types/eqp.types'
import { isActiveEquipment } from '../utils/eqp-runtime-state.util'
import type { useEqpMutations } from './useEqpMutations'

export type EqpLifecycleAction = 'start' | 'end' | 'restart' | 'reconnect'

export interface EqpLifecycleDialogState {
  open: boolean
  action: EqpLifecycleAction
  eqp: EqpInfo | null
}

export interface EqpLifecycleResultDialogState {
  open: boolean
  status: EqpOperationResultStatus
  action: EqpLifecycleAction
  eqpId: string | null
  message: string | null
  /** 재조회 대상. `delayed` 일 때 수동 재조회에 쓴다. */
  operationId: string | null
}

const EMPTY_EQP_LIFECYCLE_DIALOG_STATE: EqpLifecycleDialogState = {
  open: false,
  action: 'start',
  eqp: null,
}
const EMPTY_EQP_LIFECYCLE_RESULT_DIALOG_STATE: EqpLifecycleResultDialogState = {
  open: false,
  status: 'success',
  action: 'start',
  eqpId: null,
  message: null,
  operationId: null,
}
const EQP_ASYNC_POLL_INTERVAL_MS = 1000
const EQP_ASYNC_MAX_ATTEMPTS = 60
const PASSIVE_LIFECYCLE_UNSUPPORTED_KEY = 'eqp.lifecycle.passiveUnsupported'

type EqpMutations = ReturnType<typeof useEqpMutations>

/**
 * 라이프사이클 / 폴링 그룹 명령이 쓰는 mutation 만 받는다.
 *
 * 훅이 {@link useEqpMutations} 를 직접 호출하면 페이지의 create/update/delete mutation 과
 * 별개 인스턴스가 생겨 `isPending` 이 갈라진다 — 호출부가 쓰는 것과 같은 객체를 주입한다.
 */
interface UseEqpLifecycleCommandsParams {
  startEqpMutation: EqpMutations['startEqpMutation']
  endEqpMutation: EqpMutations['endEqpMutation']
  reconnectEqpMutation: EqpMutations['reconnectEqpMutation']
  startPollingGroupMutation: EqpMutations['startPollingGroupMutation']
  endPollingGroupMutation: EqpMutations['endPollingGroupMutation']
  /** operation 이 PASS 로 확정된 뒤에만 호출된다(§14.1 — 접수 시점 invalidate 금지). */
  onOperationPassed: () => Promise<void>
}

interface UseEqpLifecycleCommandsResult {
  lifecycleDialog: EqpLifecycleDialogState
  lifecycleResultDialog: EqpLifecycleResultDialogState
  lifecycleErrorMessage: string | null
  /** 진행 중 operation 의 현재 phase. 확인 다이얼로그의 진행 표시에 쓴다. */
  lifecyclePhase: OperationPhase | null
  /** 명령 발행부터 최장 60초 폴링 구간까지 true. 버튼 `disabled` 에 그대로 쓴다. */
  isLifecyclePending: boolean
  isPollingGroupPending: boolean
  openLifecycleDialog(eqp: EqpInfo, action: EqpLifecycleAction): void
  closeLifecycleDialog(): void
  closeLifecycleResultDialog(): void
  handleConfirmLifecycleAction(): Promise<void>
  /** 확인 지연 상태에서 사용자가 직접 다시 조회한다(§14.1). */
  recheckLifecycleOperation(): Promise<void>
  handleStartPollingGroup(eqpId: string, groupMessageName: string): Promise<boolean>
  handleEndPollingGroup(eqpId: string, groupMessageName: string): Promise<boolean>
}

/**
 * 설비 라이프사이클(start / end / restart / reconnect)과 PLC 폴링 그룹 명령을 다룹니다.
 *
 * 이 명령들은 202 를 받고 operation 조회로 완결되므로, 확인 다이얼로그 · 결과 다이얼로그 ·
 * in-flight 가드가 한 덩어리로 움직인다. 페이지의 선택 상태나 파라미터 편집과는 공유 상태가
 * 없어 이 훅으로 분리했다.
 *
 * <p>조회 횟수를 소진해도 **실패로 확정하지 않는다** — backend operation 은 살아 있고 늦은 적용이
 * 실제 결과로 수렴한다(§14.2). 그 경우는 `delayed` 로 표시하고 수동 재조회를 허용한다.</p>
 */
export function useEqpLifecycleCommands({
  startEqpMutation,
  endEqpMutation,
  reconnectEqpMutation,
  startPollingGroupMutation,
  endPollingGroupMutation,
  onOperationPassed,
}: UseEqpLifecycleCommandsParams): UseEqpLifecycleCommandsResult {
  const { t } = useI18n()

  const [lifecycleDialog, setLifecycleDialog] = useState<EqpLifecycleDialogState>(
    EMPTY_EQP_LIFECYCLE_DIALOG_STATE,
  )
  const [lifecycleResultDialog, setLifecycleResultDialog] = useState<EqpLifecycleResultDialogState>(
    EMPTY_EQP_LIFECYCLE_RESULT_DIALOG_STATE,
  )
  const [lifecycleErrorMessage, setLifecycleErrorMessage] = useState<string | null>(null)
  const [lifecyclePhase, setLifecyclePhase] = useState<OperationPhase | null>(null)

  // 202 + 폴링으로 완결되는 명령의 in-flight 가드 — 폴링 구간까지 재진입을 막는다.
  const lifecycleGuard = useAsyncCommandGuard()
  const pollingGroupGuard = useAsyncCommandGuard()

  const openLifecycleDialog = useCallback((eqp: EqpInfo, action: EqpLifecycleAction) => {
    setLifecycleErrorMessage(null)
    setLifecycleResultDialog(EMPTY_EQP_LIFECYCLE_RESULT_DIALOG_STATE)
    if (!isActiveEquipment(eqp)) {
      setLifecycleResultDialog({
        open: true,
        status: 'failure',
        action,
        eqpId: eqp.eqpId,
        message: t(PASSIVE_LIFECYCLE_UNSUPPORTED_KEY),
        operationId: null,
      })
      return
    }
    setLifecycleDialog({
      open: true,
      action,
      eqp,
    })
  }, [t])

  const closeLifecycleDialog = useCallback(() => {
    setLifecycleDialog(EMPTY_EQP_LIFECYCLE_DIALOG_STATE)
    setLifecycleErrorMessage(null)
    setLifecyclePhase(null)
  }, [])

  const closeLifecycleResultDialog = useCallback(() => {
    setLifecycleResultDialog(EMPTY_EQP_LIFECYCLE_RESULT_DIALOG_STATE)
  }, [])

  const trackOperation = useCallback(
    (operationId: string): Promise<OperationOutcome> =>
      pollOperationUntilTerminal({
        fetchStatus: operationApi.getOperationStatus,
        operationId,
        intervalMs: EQP_ASYNC_POLL_INTERVAL_MS,
        maxAttempts: EQP_ASYNC_MAX_ATTEMPTS,
        onProgress: (status) => setLifecyclePhase(status.phase),
        wait: waitWithBrowserTimer,
      }),
    [],
  )

  /**
   * 한 단계를 발행하고 결과를 기다린다. PASS 가 아니면 그 결과를 그대로 돌려준다 —
   * restart 처럼 두 단계로 이뤄진 명령의 **부분 적용**도 operation 상태로 드러나야 한다(§14.2).
   */
  const runLifecycleStep = useCallback(
    async (dispatch: () => Promise<string>): Promise<OperationOutcome> => {
      const operationId = await dispatch()
      return trackOperation(operationId)
    },
    [trackOperation],
  )

  const executeLifecycleAction = useCallback(
    async (eqp: EqpInfo, action: EqpLifecycleAction): Promise<OperationOutcome> => {
      if (!isActiveEquipment(eqp)) {
        throw new Error(t(PASSIVE_LIFECYCLE_UNSUPPORTED_KEY))
      }

      const request = {
        interfaceType: eqp.commInterface,
        uiMessage: null,
      } as const

      if (action === 'start') {
        return runLifecycleStep(() => startEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request }))
      }

      if (action === 'end') {
        return runLifecycleStep(() => endEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request }))
      }

      if (action === 'reconnect') {
        // stuck(desired=STARTED + control=OFFLINE) 복구 — END+START 가 아니라 EQP_RECONNECT 단일 명령.
        return runLifecycleStep(() =>
          reconnectEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request }),
        )
      }

      const endOutcome = await runLifecycleStep(() =>
        endEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request }),
      )
      if (endOutcome.kind !== 'PASS') {
        return endOutcome
      }

      return runLifecycleStep(() => startEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request }))
    },
    [endEqpMutation, startEqpMutation, reconnectEqpMutation, runLifecycleStep, t],
  )

  /**
   * operation 결과를 결과 다이얼로그 상태로 옮긴다.
   *
   * `DELAYED` 를 `failure` 로 접으면 실제로는 진행 중인 변경을 실패로 보고하게 된다 —
   * 별도 상태로 유지하고 재조회 경로를 남긴다.
   */
  const applyOutcomeToResultDialog = useCallback(
    (outcome: OperationOutcome, action: EqpLifecycleAction, eqpId: string, fallback: string) => {
      if (outcome.kind === 'PASS') {
        setLifecycleResultDialog({
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
        setLifecycleResultDialog({
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
        setLifecycleResultDialog({
          open: true,
          status: 'delayed',
          action,
          eqpId,
          message: null,
          operationId: outcome.status?.operationId ?? null,
        })
        return
      }

      setLifecycleResultDialog({
        open: true,
        status: 'failure',
        action,
        eqpId,
        message: outcome.status.errorMsg ?? fallback,
        operationId: outcome.status.operationId,
      })
    },
    [],
  )

  const handleConfirmLifecycleAction = useCallback(async () => {
    const targetEqp = lifecycleDialog.eqp
    const action = lifecycleDialog.action

    if (!targetEqp) {
      setLifecycleErrorMessage(t('eqp.page.noSelectedForAction'))
      return
    }

    await lifecycleGuard.run(async () => {
      try {
        setLifecycleErrorMessage(null)
        const outcome = await executeLifecycleAction(targetEqp, action)
        closeLifecycleDialog()
        applyOutcomeToResultDialog(
          outcome,
          action,
          targetEqp.eqpId,
          t('eqp.page.lifecycleFailed'),
        )
        if (outcome.kind === 'PASS') {
          await onOperationPassed()
        }
      } catch (error) {
        const resolvedMessage = resolveErrorMessage(error, t('eqp.page.lifecycleFailed'))

        closeLifecycleDialog()
        setLifecycleResultDialog({
          open: true,
          status: 'failure',
          action,
          eqpId: targetEqp.eqpId,
          message: resolvedMessage,
          operationId: null,
        })
      }
    })
  }, [
    applyOutcomeToResultDialog,
    closeLifecycleDialog,
    executeLifecycleAction,
    lifecycleDialog,
    lifecycleGuard,
    onOperationPassed,
    t,
  ])

  const recheckLifecycleOperation = useCallback(async () => {
    const { operationId, action, eqpId } = lifecycleResultDialog
    if (!operationId || !eqpId) {
      return
    }

    await lifecycleGuard.run(async () => {
      try {
        const outcome = await trackOperation(operationId)
        applyOutcomeToResultDialog(outcome, action, eqpId, t('eqp.page.lifecycleFailed'))
        if (outcome.kind === 'PASS') {
          await onOperationPassed()
        }
      } catch (error) {
        setLifecycleResultDialog((previous) => ({
          ...previous,
          status: 'failure',
          message: resolveErrorMessage(error, t('eqp.page.lifecycleFailed')),
        }))
      }
    })
  }, [
    applyOutcomeToResultDialog,
    lifecycleGuard,
    lifecycleResultDialog,
    onOperationPassed,
    t,
    trackOperation,
  ])

  // 두 flag 는 mutateAsync(202) settle 뒤 최장 60초 폴링 구간까지 덮어야 한다 — guard 없이
  // mutation.isPending 만 보면 그 구간에 버튼이 되살아나 명령이 중복 발행된다(S09 D-1 / D-2).
  const isLifecyclePending =
    lifecycleGuard.isRunning ||
    startEqpMutation.isPending ||
    endEqpMutation.isPending ||
    reconnectEqpMutation.isPending

  const isPollingGroupPending =
    pollingGroupGuard.isRunning ||
    startPollingGroupMutation.isPending ||
    endPollingGroupMutation.isPending

  const handleStartPollingGroup = useCallback(
    async (eqpId: string, groupMessageName: string): Promise<boolean> => {
      const result = await pollingGroupGuard.run(async () => {
        const outcome = await runLifecycleStep(() =>
          startPollingGroupMutation.mutateAsync({ eqpId, groupMessageName }),
        )
        if (outcome.kind === 'PASS') {
          await onOperationPassed()
        }
      })
      return result.dispatched
    },
    [onOperationPassed, pollingGroupGuard, runLifecycleStep, startPollingGroupMutation],
  )

  const handleEndPollingGroup = useCallback(
    async (eqpId: string, groupMessageName: string): Promise<boolean> => {
      const result = await pollingGroupGuard.run(async () => {
        const outcome = await runLifecycleStep(() =>
          endPollingGroupMutation.mutateAsync({ eqpId, groupMessageName }),
        )
        if (outcome.kind === 'PASS') {
          await onOperationPassed()
        }
      })
      return result.dispatched
    },
    [endPollingGroupMutation, onOperationPassed, pollingGroupGuard, runLifecycleStep],
  )

  return {
    lifecycleDialog,
    lifecycleResultDialog,
    lifecycleErrorMessage,
    lifecyclePhase,
    isLifecyclePending,
    isPollingGroupPending,
    openLifecycleDialog,
    closeLifecycleDialog,
    closeLifecycleResultDialog,
    handleConfirmLifecycleAction,
    recheckLifecycleOperation,
    handleStartPollingGroup,
    handleEndPollingGroup,
  }
}
