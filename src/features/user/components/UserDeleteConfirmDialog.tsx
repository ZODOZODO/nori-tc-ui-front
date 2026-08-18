import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useI18n } from '@/i18n/i18n-context'
import { useDeleteUser } from '../hooks/useUserMutations'
import { ApiError } from '@/shared/lib/api-error'

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
  const { t } = useI18n()
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
      if (error instanceof ApiError) {
        setErrorMessage(error.payload.errorMsg)
        return
      }
      setErrorMessage(t('error.user.delete'))
    }
  }

  const description = targetUserId
    ? t('user.delete.confirmWithId', { userId: targetUserId })
    : t('user.delete.confirm')

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}
      title={t('user.delete.title')}
      description={description}
      confirmText={t('common.delete')}
      cancelText={t('common.cancel')}
      confirmVariant="destructive"
      isConfirming={deleteUserMutation.isPending}
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
