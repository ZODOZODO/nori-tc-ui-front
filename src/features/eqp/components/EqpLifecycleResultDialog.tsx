import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n/i18n-context'
import { EqpOperationResultBody } from './EqpOperationResultBody'
import {
  OPERATION_RESULT_PRESENTATION,
  type EqpOperationResultStatus,
} from '../lib/eqp-operation-result-presentation'

type EqpLifecycleAction = 'start' | 'end' | 'restart' | 'reconnect'

interface EqpLifecycleResultDialogProps {
  open: boolean
  status: EqpOperationResultStatus
  action: EqpLifecycleAction
  eqpId: string | null
  message: string | null
  operationId: string | null
  isRechecking: boolean
  onRecheck: () => void
  onOpenChange: (open: boolean) => void
}

/** action × status → i18n 키 (정적 제목). 결과 메시지는 eqpId 임베드라 동적 유지. */
const ACTION_RESULT_TITLE_KEYS: Record<
  EqpLifecycleAction,
  Record<EqpOperationResultStatus, string>
> = {
  start: {
    success: 'eqp.lifecycle.startSuccess',
    failure: 'eqp.lifecycle.startFailure',
    repair: 'eqp.lifecycle.startRepairRequired',
    delayed: 'eqp.lifecycle.startDelayed',
  },
  end: {
    success: 'eqp.lifecycle.endSuccess',
    failure: 'eqp.lifecycle.endFailure',
    repair: 'eqp.lifecycle.endRepairRequired',
    delayed: 'eqp.lifecycle.endDelayed',
  },
  restart: {
    success: 'eqp.lifecycle.restartSuccess',
    failure: 'eqp.lifecycle.restartFailure',
    repair: 'eqp.lifecycle.restartRepairRequired',
    delayed: 'eqp.lifecycle.restartDelayed',
  },
  reconnect: {
    success: 'eqp.lifecycle.reconnectSuccess',
    failure: 'eqp.lifecycle.reconnectFailure',
    repair: 'eqp.lifecycle.reconnectRepairRequired',
    delayed: 'eqp.lifecycle.reconnectDelayed',
  },
}

/** action × status → 결과 메시지 i18n 키. eqpId 는 보간으로 주입한다. */
const ACTION_RESULT_MESSAGE_KEYS: Record<
  EqpLifecycleAction,
  Record<EqpOperationResultStatus, string>
> = {
  start: {
    success: 'eqp.lifecycle.resultStartSuccess',
    failure: 'eqp.lifecycle.resultStartFailure',
    repair: 'eqp.lifecycle.resultStartRepairRequired',
    delayed: 'eqp.lifecycle.resultStartDelayed',
  },
  end: {
    success: 'eqp.lifecycle.resultEndSuccess',
    failure: 'eqp.lifecycle.resultEndFailure',
    repair: 'eqp.lifecycle.resultEndRepairRequired',
    delayed: 'eqp.lifecycle.resultEndDelayed',
  },
  restart: {
    success: 'eqp.lifecycle.resultRestartSuccess',
    failure: 'eqp.lifecycle.resultRestartFailure',
    repair: 'eqp.lifecycle.resultRestartRepairRequired',
    delayed: 'eqp.lifecycle.resultRestartDelayed',
  },
  reconnect: {
    success: 'eqp.lifecycle.resultReconnectSuccess',
    failure: 'eqp.lifecycle.resultReconnectFailure',
    repair: 'eqp.lifecycle.resultReconnectRepairRequired',
    delayed: 'eqp.lifecycle.resultReconnectDelayed',
  },
}

export function EqpLifecycleResultDialog({
  open,
  status,
  action,
  eqpId,
  message,
  operationId,
  isRechecking,
  onRecheck,
  onOpenChange,
}: EqpLifecycleResultDialogProps) {
  const { t } = useI18n()
  const { icon: ResultIcon, iconClass, resultKey } = OPERATION_RESULT_PRESENTATION[status]
  const title = t(ACTION_RESULT_TITLE_KEYS[action][status])
  const resolvedMessage =
    message ??
    t(ACTION_RESULT_MESSAGE_KEYS[action][status], {
      eqpId: eqpId ?? t('eqp.common.selectedTarget'),
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-120">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ResultIcon className={iconClass} aria-hidden="true" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>
            {t('eqp.result.label')}: {t(resultKey)}
          </DialogDescription>
        </DialogHeader>

        <EqpOperationResultBody
          status={status}
          message={resolvedMessage}
          operationId={operationId}
        />

        <DialogFooter>
          {status === 'delayed' && operationId !== null && (
            <Button type="button" variant="outline" disabled={isRechecking} onClick={onRecheck}>
              {t('eqp.operation.recheck')}
            </Button>
          )}
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('eqp.common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
