import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useI18n } from '@/i18n/i18n-context'
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
  const { t } = useI18n()
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
      setErrorMessage(t('error.group.delete'))
    }
  }

  const description = targetGroupCode
    ? t('group.delete.confirmWithId', { code: targetGroupCode })
    : t('group.delete.confirm')

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}
      title={t('group.delete.title')}
      description={description}
      confirmText={t('common.delete')}
      cancelText={t('common.cancel')}
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
