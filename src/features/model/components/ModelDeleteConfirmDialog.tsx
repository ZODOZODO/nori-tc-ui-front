import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  const resolvedTitle =
    mode === 'deprecated-branches'
      ? 'Branch Deprecated Model Delete'
      : mode === 'branch'
        ? 'Branch Model Delete'
        : 'Model Delete'

  const resolvedDescription =
    mode === 'deprecated-branches'
      ? targetModel
        ? `${targetModel.modelName} root에 연결된 deprecated branch를 일괄 삭제하시겠습니까? 최신 상태가 DEPRECATED인 branch만 삭제됩니다.`
        : '선택한 root에 연결된 deprecated branch를 일괄 삭제하시겠습니까?'
      : mode === 'branch'
        ? targetModel
          ? `${targetModel.modelName} branch model을 삭제하시겠습니까? EQP 참조 중이면 삭제가 거부될 수 있습니다.`
          : '선택한 branch model을 삭제하시겠습니까?'
        : targetModel
          ? `${targetModel.modelName} root model과 연결된 branch를 함께 삭제하시겠습니까? EQP 참조 중이면 삭제가 거부될 수 있습니다.`
          : '선택한 root model을 삭제하시겠습니까?'

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
