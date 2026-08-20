import { useCallback, useState } from 'react'
import { useI18n } from '@/i18n/i18n-context'
import { useAsyncCommandGuard } from '@/shared/hooks/useAsyncCommandGuard'
import { eqpApi } from '../api/eqp.api'
import { resolveErrorMessage } from '@/shared/lib/resolve-error-message'
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
  status: 'success' | 'failure'
  action: EqpLifecycleAction
  eqpId: string | null
  message: string | null
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
}

interface UseEqpLifecycleCommandsResult {
  lifecycleDialog: EqpLifecycleDialogState
  lifecycleResultDialog: EqpLifecycleResultDialogState
  lifecycleErrorMessage: string | null
  /** 명령 발행부터 최장 60초 폴링 구간까지 true. 버튼 `disabled` 에 그대로 쓴다. */
  isLifecyclePending: boolean
  isPollingGroupPending: boolean
  openLifecycleDialog(eqp: EqpInfo, action: EqpLifecycleAction): void
  closeLifecycleDialog(): void
  closeLifecycleResultDialog(): void
  handleConfirmLifecycleAction(): Promise<void>
  handleStartPollingGroup(eqpId: string, groupMessageName: string): Promise<boolean>
  handleEndPollingGroup(eqpId: string, groupMessageName: string): Promise<boolean>
}

/**
 * 설비 라이프사이클(start / end / restart / reconnect)과 PLC 폴링 그룹 명령을 다룹니다.
 *
 * 이 명령들은 202 를 받고 `getAsyncResult` 폴링으로 완결되므로, 확인 다이얼로그 · 결과
 * 다이얼로그 · in-flight 가드가 한 덩어리로 움직인다. 페이지의 선택 상태나 파라미터 편집과는
 * 공유 상태가 없어 이 훅으로 분리했다.
 */
export function useEqpLifecycleCommands({
  startEqpMutation,
  endEqpMutation,
  reconnectEqpMutation,
  startPollingGroupMutation,
  endPollingGroupMutation,
}: UseEqpLifecycleCommandsParams): UseEqpLifecycleCommandsResult {
  const { t } = useI18n()

  const [lifecycleDialog, setLifecycleDialog] = useState<EqpLifecycleDialogState>(
    EMPTY_EQP_LIFECYCLE_DIALOG_STATE,
  )
  const [lifecycleResultDialog, setLifecycleResultDialog] = useState<EqpLifecycleResultDialogState>(
    EMPTY_EQP_LIFECYCLE_RESULT_DIALOG_STATE,
  )
  const [lifecycleErrorMessage, setLifecycleErrorMessage] = useState<string | null>(null)

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
  }, [])

  const closeLifecycleResultDialog = useCallback(() => {
    setLifecycleResultDialog(EMPTY_EQP_LIFECYCLE_RESULT_DIALOG_STATE)
  }, [])

  const waitForEqpAsyncCompletion = useCallback(
    async (traceId: string, fallbackMessage: string) => {
      for (let attempt = 0; attempt < EQP_ASYNC_MAX_ATTEMPTS; attempt += 1) {
        const result = await eqpApi.getAsyncResult(traceId)

        if (result.status === 'PASS') {
          return
        }

        if (result.status === 'FAIL' || result.status === 'TIMEOUT') {
          throw new Error(result.errorMsg ?? fallbackMessage)
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, EQP_ASYNC_POLL_INTERVAL_MS)
        })
      }

      throw new Error(fallbackMessage)
    },
    [],
  )

  const executeLifecycleAction = useCallback(
    async (eqp: EqpInfo, action: EqpLifecycleAction) => {
      if (!isActiveEquipment(eqp)) {
        throw new Error(t(PASSIVE_LIFECYCLE_UNSUPPORTED_KEY))
      }

      const request = {
        interfaceType: eqp.commInterface,
        uiMessage: null,
      } as const

      if (action === 'start') {
        const traceId = await startEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
        await waitForEqpAsyncCompletion(traceId, t('eqp.page.startTimeout'))
        return
      }

      if (action === 'end') {
        const traceId = await endEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
        await waitForEqpAsyncCompletion(traceId, t('eqp.page.endTimeout'))
        return
      }

      if (action === 'reconnect') {
        // stuck(desired=STARTED + control=OFFLINE) 복구 — END+START 가 아니라 EQP_RECONNECT 단일 명령.
        const traceId = await reconnectEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
        await waitForEqpAsyncCompletion(traceId, t('eqp.page.startTimeout'))
        return
      }

      const endTraceId = await endEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
      await waitForEqpAsyncCompletion(endTraceId, t('eqp.page.endTimeout'))

      const startTraceId = await startEqpMutation.mutateAsync({ eqpId: eqp.eqpId, request })
      await waitForEqpAsyncCompletion(startTraceId, t('eqp.page.startTimeout'))
    },
    [endEqpMutation, startEqpMutation, reconnectEqpMutation, waitForEqpAsyncCompletion, t],
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
        await executeLifecycleAction(targetEqp, action)
        closeLifecycleDialog()
        setLifecycleResultDialog({
          open: true,
          status: 'success',
          action,
          eqpId: targetEqp.eqpId,
          message: null,
        })
      } catch (error) {
        const resolvedMessage = resolveErrorMessage(error, t('eqp.page.lifecycleFailed'))

        closeLifecycleDialog()
        setLifecycleResultDialog({
          open: true,
          status: 'failure',
          action,
          eqpId: targetEqp.eqpId,
          message: resolvedMessage,
        })
      }
    })
  }, [closeLifecycleDialog, executeLifecycleAction, lifecycleDialog, lifecycleGuard, t])

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
        const traceId = await startPollingGroupMutation.mutateAsync({ eqpId, groupMessageName })
        await waitForEqpAsyncCompletion(traceId, t('eqp.page.pollingGroupStartTimeout'))
      })
      return result.dispatched
    },
    [pollingGroupGuard, startPollingGroupMutation, waitForEqpAsyncCompletion, t],
  )

  const handleEndPollingGroup = useCallback(
    async (eqpId: string, groupMessageName: string): Promise<boolean> => {
      const result = await pollingGroupGuard.run(async () => {
        const traceId = await endPollingGroupMutation.mutateAsync({ eqpId, groupMessageName })
        await waitForEqpAsyncCompletion(traceId, t('eqp.page.pollingGroupEndTimeout'))
      })
      return result.dispatched
    },
    [pollingGroupGuard, endPollingGroupMutation, waitForEqpAsyncCompletion, t],
  )

  return {
    lifecycleDialog,
    lifecycleResultDialog,
    lifecycleErrorMessage,
    isLifecyclePending,
    isPollingGroupPending,
    openLifecycleDialog,
    closeLifecycleDialog,
    closeLifecycleResultDialog,
    handleConfirmLifecycleAction,
    handleStartPollingGroup,
    handleEndPollingGroup,
  }
}
