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

interface EqpDeleteResultDialogProps {
  open: boolean
  status: 'success' | 'failure'
  eqpId: string | null
  message: string | null
  onOpenChange: (open: boolean) => void
}

/**
 * EQP 삭제 완료 후 최종 결과를 사용자에게 알려주는 팝업입니다.
 * 성공/실패를 분리해 보여주고, 실패 시 백엔드 원인 메시지를 그대로 확인할 수 있게 합니다.
 */
export function EqpDeleteResultDialog({
  open,
  status,
  eqpId,
  message,
  onOpenChange,
}: EqpDeleteResultDialogProps) {
  const { t } = useI18n()
  const isSuccess = status === 'success'
  const resolvedMessage =
    message ??
    t(isSuccess ? 'eqp.delete.resultSuccess' : 'eqp.delete.resultFailure', {
      eqpId: eqpId ?? t('eqp.common.selectedTarget'),
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            ) : (
              <XCircle className="size-5 text-danger" aria-hidden="true" />
            )}
            <DialogTitle>
              {isSuccess ? t('eqp.delete.successTitle') : t('eqp.delete.failureTitle')}
            </DialogTitle>
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
