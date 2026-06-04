import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useI18n } from '@/i18n/i18n-context'
import type { ModelInfo } from '../types/model.types'

export type ModelDeleteDialogMode = 'root' | 'branch' | 'deprecated-branches'

interface ModelDeleteConfirmDialogProps {
  open: boolean
  mode: ModelDeleteDialogMode
  targetModel: ModelInfo | null
  isPending: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

/**
 * root/branch/deprecated branch 정리 작업에 공통으로 사용하는 확인 다이얼로그입니다.
 */
export function ModelDeleteConfirmDialog({
  open,
  mode,
  targetModel,
  isPending,
  errorMessage,
  onOpenChange,
  onConfirm,
}: ModelDeleteConfirmDialogProps) {
  const { t } = useI18n()
  const resolvedTitle =
    mode === 'deprecated-branches'
      ? 'Branch Deprecated Model Delete'
      : mode === 'branch'
        ? 'Branch Model Delete'
        : 'Model Delete'

  const resolvedDescription =
    mode === 'deprecated-branches'
      ? targetModel
        ? t('model.delete.deprecatedWithName', { name: targetModel.modelName })
        : t('model.delete.deprecatedNoName')
      : mode === 'branch'
        ? targetModel
          ? t('model.delete.branchWithName', { name: targetModel.modelName })
          : t('model.delete.branchNoName')
        : targetModel
          ? t('model.delete.rootWithName', { name: targetModel.modelName })
          : t('model.delete.rootNoName')

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen)
        }
      }}
      title={resolvedTitle}
      description={resolvedDescription}
      confirmText={mode === 'deprecated-branches' ? 'Delete All' : 'Delete'}
      cancelText="Cancel"
      confirmVariant="destructive"
      isConfirming={isPending}
      onConfirm={() => {
        void onConfirm()
      }}
    >
      {errorMessage ? (
        <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}
    </ConfirmDialog>
  )
}
