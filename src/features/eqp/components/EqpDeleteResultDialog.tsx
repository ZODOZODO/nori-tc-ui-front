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
  const isSuccess = status === 'success'
  const resolvedMessage =
    message ??
    (isSuccess
      ? `${eqpId ?? '선택한 설비'} 삭제가 완료되었습니다.`
      : `${eqpId ?? '선택한 설비'} 삭제에 실패했습니다.`)

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
            <DialogTitle>{isSuccess ? '설비 삭제 완료' : '설비 삭제 실패'}</DialogTitle>
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
