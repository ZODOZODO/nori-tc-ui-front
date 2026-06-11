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

interface EqpDeleteConfirmDialogProps {
  open: boolean
  eqpId: string | null
  isPending: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

/**
 * EQP 삭제 전 최종 확인을 받는 다이얼로그입니다.
 * 백엔드는 END 선행과 rollback을 수행하므로, UI에서는 의도를 명확히 확인하는 역할만 담당합니다.
 */
export function EqpDeleteConfirmDialog({
  open,
  eqpId,
  isPending,
  errorMessage,
  onOpenChange,
  onConfirm,
}: EqpDeleteConfirmDialogProps) {
  const { t } = useI18n()
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
          <DialogTitle>Eqp Delete</DialogTitle>
          <DialogDescription>
            {eqpId
              ? t('eqp.delete.confirmWithId', { eqpId })
              : t('eqp.delete.confirmNoId')}
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
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              void onConfirm()
            }}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
