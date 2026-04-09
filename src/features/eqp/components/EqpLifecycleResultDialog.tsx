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

type EqpLifecycleAction = 'start' | 'end' | 'restart'

interface EqpLifecycleResultDialogProps {
  open: boolean
  status: 'success' | 'failure'
  action: EqpLifecycleAction
  eqpId: string | null
  message: string | null
  onOpenChange: (open: boolean) => void
}

const ACTION_RESULT_TITLES: Record<EqpLifecycleAction, { success: string; failure: string }> = {
  start: { success: '설비 시작 완료', failure: '설비 시작 실패' },
  end: { success: '설비 종료 완료', failure: '설비 종료 실패' },
  restart: { success: '설비 재시작 완료', failure: '설비 재시작 실패' },
}

const ACTION_RESULT_MESSAGES: Record<EqpLifecycleAction, { success: string; failure: string }> = {
  start: { success: '시작이 완료되었습니다.', failure: '시작에 실패했습니다.' },
  end: { success: '종료가 완료되었습니다.', failure: '종료에 실패했습니다.' },
  restart: { success: '재시작이 완료되었습니다.', failure: '재시작에 실패했습니다.' },
}

export function EqpLifecycleResultDialog({
  open,
  status,
  action,
  eqpId,
  message,
  onOpenChange,
}: EqpLifecycleResultDialogProps) {
  const isSuccess = status === 'success'
  const title = isSuccess ? ACTION_RESULT_TITLES[action].success : ACTION_RESULT_TITLES[action].failure
  const resolvedMessage =
    message ??
    `${eqpId ?? '선택한 설비'} ${
      isSuccess ? ACTION_RESULT_MESSAGES[action].success : ACTION_RESULT_MESSAGES[action].failure
    }`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="size-5 text-[#1C7F59]" aria-hidden="true" />
            ) : (
              <XCircle className="size-5 text-[#B4483F]" aria-hidden="true" />
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>
            결과: {isSuccess ? 'PASS' : 'FAIL'}
          </DialogDescription>
        </DialogHeader>

        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            isSuccess
              ? 'border-[#CAE7D8] bg-[#F4FBF7] text-[#1E5B43]'
              : 'border-[#F0D2D0] bg-[#FFF7F7] text-[#B4483F]'
          }`}
        >
          {resolvedMessage}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
