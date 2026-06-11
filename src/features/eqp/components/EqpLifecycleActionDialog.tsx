import { Loader2 } from 'lucide-react'
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

interface EqpLifecycleActionDialogProps {
  open: boolean
  action: EqpLifecycleAction
  eqpId: string | null
  isPending: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

const ACTION_LABELS: Record<EqpLifecycleAction, string> = {
  start: 'Eqp Start',
  end: 'Eqp End',
  restart: 'Eqp Restart',
}

// action → 동사 i18n 키. 확인 문구는 eqpId 유무에 따라 두 키로 분기한다.
const ACTION_VERB_KEYS: Record<EqpLifecycleAction, string> = {
  start: 'eqp.lifecycle.verbStart',
  end: 'eqp.lifecycle.verbEnd',
  restart: 'eqp.lifecycle.verbRestart',
}

export function EqpLifecycleActionDialog({
  open,
  action,
  eqpId,
  isPending,
  errorMessage,
  onOpenChange,
  onConfirm,
}: EqpLifecycleActionDialogProps) {
  const { t } = useI18n()
  const verb = t(ACTION_VERB_KEYS[action])
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent className="max-w-120" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[action]}</DialogTitle>
          <DialogDescription>
            {eqpId
              ? t('eqp.lifecycle.confirmWithId', { eqpId, verb })
              : t('eqp.lifecycle.confirmNoId', { verb })}
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              void onConfirm()
            }}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {ACTION_LABELS[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
