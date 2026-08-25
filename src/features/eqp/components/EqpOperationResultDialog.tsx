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
import type { EqpMutationAction } from '../hooks/useEqpMutationCommands'

interface EqpOperationResultDialogProps {
  open: boolean
  status: EqpOperationResultStatus
  action: EqpMutationAction
  eqpId: string | null
  message: string | null
  operationId: string | null
  isRechecking: boolean
  onRecheck: () => void
  onOpenChange: (open: boolean) => void
}

/** action × status → 제목 i18n 키. */
const TITLE_KEYS: Record<EqpMutationAction, Record<EqpOperationResultStatus, string>> = {
  create: {
    success: 'eqp.operation.createSuccessTitle',
    failure: 'eqp.operation.createFailureTitle',
    repair: 'eqp.operation.createRepairRequiredTitle',
    delayed: 'eqp.operation.createDelayedTitle',
  },
  update: {
    success: 'eqp.operation.updateSuccessTitle',
    failure: 'eqp.operation.updateFailureTitle',
    repair: 'eqp.operation.updateRepairRequiredTitle',
    delayed: 'eqp.operation.updateDelayedTitle',
  },
  delete: {
    success: 'eqp.delete.successTitle',
    failure: 'eqp.delete.failureTitle',
    repair: 'eqp.operation.deleteRepairRequiredTitle',
    delayed: 'eqp.operation.deleteDelayedTitle',
  },
}

/** action × status → 기본 메시지 i18n 키. eqpId 는 보간으로 주입한다. */
const MESSAGE_KEYS: Record<EqpMutationAction, Record<EqpOperationResultStatus, string>> = {
  create: {
    success: 'eqp.operation.createSuccessMessage',
    failure: 'eqp.operation.createFailureMessage',
    repair: 'eqp.operation.repairRequiredMessage',
    delayed: 'eqp.operation.delayedMessage',
  },
  update: {
    success: 'eqp.operation.updateSuccessMessage',
    failure: 'eqp.operation.updateFailureMessage',
    repair: 'eqp.operation.repairRequiredMessage',
    delayed: 'eqp.operation.delayedMessage',
  },
  delete: {
    success: 'eqp.page.deleteSuccess',
    failure: 'eqp.delete.resultFailure',
    repair: 'eqp.operation.repairRequiredMessage',
    delayed: 'eqp.operation.delayedMessage',
  },
}

/**
 * 설비 create / update / delete operation 의 최종 결과 팝업입니다(§14.1).
 *
 * <p>접수(202)만으로는 열리지 않습니다 — operation 이 `PASS` / `FAIL` / `REPAIR_REQUIRED` 로
 * 확정되거나 확인이 지연될 때 열립니다. 네 상태를 각각 다르게 표시하며, 확인 지연은 수동
 * 재조회 버튼을 함께 노출합니다.</p>
 */
export function EqpOperationResultDialog({
  open,
  status,
  action,
  eqpId,
  message,
  operationId,
  isRechecking,
  onRecheck,
  onOpenChange,
}: EqpOperationResultDialogProps) {
  const { t } = useI18n()
  const { icon: ResultIcon, iconClass, resultKey } = OPERATION_RESULT_PRESENTATION[status]
  const resolvedMessage =
    message ??
    t(MESSAGE_KEYS[action][status], {
      eqpId: eqpId ?? t('eqp.common.selectedTarget'),
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-120">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ResultIcon className={iconClass} aria-hidden="true" />
            <DialogTitle>{t(TITLE_KEYS[action][status])}</DialogTitle>
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
