import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useDeleteGroup } from '../hooks/useGroupMutations'
import { GroupApiError } from '../types/group.types'

interface GroupDeleteConfirmDialogProps {
  open: boolean
  targetGroupId: number | null
  targetGroupCode: string | null
  onClose: () => void
  onDeleted?: () => void
}

/**
 * 그룹 삭제 확인 다이얼로그입니다. DELETE 호출 성공 시 onDeleted 콜백을 호출합니다.
 */
export function GroupDeleteConfirmDialog({
  open,
  targetGroupId,
  targetGroupCode,
  onClose,
  onDeleted,
}: GroupDeleteConfirmDialogProps) {
  const deleteGroupMutation = useDeleteGroup()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (targetGroupId === null) {
      return
    }
    setErrorMessage(null)
    try {
      await deleteGroupMutation.mutateAsync(targetGroupId)
      onDeleted?.()
      onClose()
    } catch (error) {
      if (error instanceof GroupApiError) {
        setErrorMessage(error.payload.errorMsg)
        return
      }
      setErrorMessage('그룹 삭제에 실패했습니다.')
    }
  }

  const description = targetGroupCode
    ? `그룹 ${targetGroupCode} 을(를) 삭제합니다. 되돌릴 수 없습니다.`
    : '선택한 그룹을 삭제합니다. 되돌릴 수 없습니다.'

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}
      title="그룹 삭제"
      description={description}
      confirmText="삭제"
      cancelText="취소"
      confirmVariant="destructive"
      isConfirming={deleteGroupMutation.isPending}
      onConfirm={() => void handleConfirm()}
    >
      {errorMessage ? (
        <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}
    </ConfirmDialog>
  )
}
