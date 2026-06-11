import { CheckCircle2, XCircle } from 'lucide-react'
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

type EqpLifecycleAction = 'start' | 'end' | 'restart'

interface EqpLifecycleResultDialogProps {
  open: boolean
  status: 'success' | 'failure'
  action: EqpLifecycleAction
  eqpId: string | null
  message: string | null
  onOpenChange: (open: boolean) => void
}

/** action × status → i18n 키 (정적 제목). 결과 메시지는 eqpId 임베드라 동적 유지. */
const ACTION_RESULT_TITLE_KEYS: Record<EqpLifecycleAction, { success: string; failure: string }> = {
  start: { success: 'eqp.lifecycle.startSuccess', failure: 'eqp.lifecycle.startFailure' },
  end: { success: 'eqp.lifecycle.endSuccess', failure: 'eqp.lifecycle.endFailure' },
  restart: { success: 'eqp.lifecycle.restartSuccess', failure: 'eqp.lifecycle.restartFailure' },
}

/** action × status → 결과 메시지 i18n 키. eqpId 는 보간으로 주입한다. */
const ACTION_RESULT_MESSAGE_KEYS: Record<EqpLifecycleAction, { success: string; failure: string }> = {
  start: { success: 'eqp.lifecycle.resultStartSuccess', failure: 'eqp.lifecycle.resultStartFailure' },
  end: { success: 'eqp.lifecycle.resultEndSuccess', failure: 'eqp.lifecycle.resultEndFailure' },
  restart: { success: 'eqp.lifecycle.resultRestartSuccess', failure: 'eqp.lifecycle.resultRestartFailure' },
}

export function EqpLifecycleResultDialog({
  open,
  status,
  action,
  eqpId,
  message,
  onOpenChange,
}: EqpLifecycleResultDialogProps) {
  const { t } = useI18n()
  const isSuccess = status === 'success'
  const title = isSuccess
    ? t(ACTION_RESULT_TITLE_KEYS[action].success)
    : t(ACTION_RESULT_TITLE_KEYS[action].failure)
  const resolvedMessage =
    message ??
    t(
      isSuccess
        ? ACTION_RESULT_MESSAGE_KEYS[action].success
        : ACTION_RESULT_MESSAGE_KEYS[action].failure,
      { eqpId: eqpId ?? t('eqp.common.selectedTarget') },
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-120">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            ) : (
              <XCircle className="size-5 text-danger" aria-hidden="true" />
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>
            {t('eqp.result.label')}: {isSuccess ? 'PASS' : 'FAIL'}
          </DialogDescription>
        </DialogHeader>

        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            isSuccess
              ? 'border-success/30 bg-success/10 text-foreground'
              : 'border-danger/30 bg-danger/5 text-danger'
          }`}
        >
          {resolvedMessage}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('eqp.common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
