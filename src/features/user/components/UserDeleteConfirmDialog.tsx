import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useDeleteUser } from '../hooks/useUserMutations'
import { UserApiError } from '../types/user.types'

interface UserDeleteConfirmDialogProps {
  open: boolean
  targetUserPk: number | null
  targetUserId: string | null
  onClose: () => void
  onDeleted?: () => void
}

/**
 * 사용자 삭제 확인 다이얼로그입니다. DELETE 호출 성공 시 onDeleted 콜백을 호출합니다.
 */
export function UserDeleteConfirmDialog({
  open,
  targetUserPk,
  targetUserId,
  onClose,
  onDeleted,
}: UserDeleteConfirmDialogProps) {
  const deleteUserMutation = useDeleteUser()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (targetUserPk === null) {
      return
    }
    setErrorMessage(null)
    try {
      await deleteUserMutation.mutateAsync(targetUserPk)
      onDeleted?.()
      onClose()
    } catch (error) {
      if (error instanceof UserApiError) {
        setErrorMessage(error.payload.errorMsg)
        return
      }
      setErrorMessage('사용자 삭제에 실패했습니다.')
    }
  }

  const description = targetUserId
    ? `사용자 ${targetUserId} 을(를) 삭제합니다. 되돌릴 수 없습니다.`
    : '선택한 사용자를 삭제합니다. 되돌릴 수 없습니다.'

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}
      title="사용자 삭제"
      description={description}
      confirmText="삭제"
      cancelText="취소"
      confirmVariant="destructive"
      isConfirming={deleteUserMutation.isPending}
      onConfirm={() => void handleConfirm()}
    >
      {errorMessage ? (
        <p className="rounded-md border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-sm text-[#B4483F]">
          {errorMessage}
        </p>
      ) : null}
    </ConfirmDialog>
  )
}
