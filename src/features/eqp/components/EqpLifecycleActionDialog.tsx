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

const ACTION_MESSAGES: Record<EqpLifecycleAction, string> = {
  start: '시작',
  end: '종료',
  restart: '재시작',
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
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen)
        }
      }}
    >
      <DialogContent className="max-w-[480px]" showCloseButton={!isPending}>
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[action]}</DialogTitle>
          <DialogDescription>
            {eqpId
              ? `${eqpId} 설비를 ${ACTION_MESSAGES[action]}하시겠습니까?`
              : `선택한 설비를 ${ACTION_MESSAGES[action]}하시겠습니까?`}
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
