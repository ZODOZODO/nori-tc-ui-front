import { useMemo, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { useCreateGroup, useUpdateGroup } from '../hooks/useGroupMutations'
import { useGroupDetail } from '../hooks/useGroups'
import type { GroupUpsertRequest } from '../types/group.types'
import { GroupApiError } from '../types/group.types'

interface GroupUpsertModalProps {
  open: boolean
  mode: 'create' | 'edit'
  targetGroupId: number | null
  onClose: () => void
}

interface GroupUpsertFormState {
  groupCode: string
  groupName: string
  description: string
  isActive: boolean
}

type DraftFormState = Partial<GroupUpsertFormState>

/**
 * 그룹 등록 / 수정 공용 모달입니다.
 * UserUpsertModal 와 동일 패턴 — draft + 서버 응답을 useMemo 로 머지.
 */
export function GroupUpsertModal({ open, mode, targetGroupId, onClose }: GroupUpsertModalProps) {
  const [draftFormState, setDraftFormState] = useState<DraftFormState>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const groupDetailQuery = useGroupDetail(
    mode === 'edit' ? targetGroupId : null,
    open && mode === 'edit',
  )
  const createGroupMutation = useCreateGroup()
  const updateGroupMutation = useUpdateGroup()
  const isBusy = createGroupMutation.isPending || updateGroupMutation.isPending

  const resolvedFormState = useMemo<GroupUpsertFormState>(() => {
    if (mode === 'create') {
      return {
        groupCode: draftFormState.groupCode ?? '',
        groupName: draftFormState.groupName ?? '',
        description: draftFormState.description ?? '',
        isActive: draftFormState.isActive ?? true,
      }
    }

    const detail = groupDetailQuery.data
    return {
      groupCode: draftFormState.groupCode ?? detail?.groupCode ?? '',
      groupName: draftFormState.groupName ?? detail?.groupName ?? '',
      description: draftFormState.description ?? detail?.description ?? '',
      isActive: draftFormState.isActive ?? detail?.isActive ?? true,
    }
  }, [mode, draftFormState, groupDetailQuery.data])

  const handleClose = () => {
    if (isBusy) {
      return
    }
    setDraftFormState({})
    setErrorMessage(null)
    onClose()
  }

  const handleChange = <K extends keyof GroupUpsertFormState>(
    field: K,
    value: GroupUpsertFormState[K],
  ) => {
    setDraftFormState((previous) => ({ ...previous, [field]: value }))
  }

  const handleSubmit = async () => {
    setErrorMessage(null)
    const trimmed: GroupUpsertFormState = {
      groupCode: resolvedFormState.groupCode.trim(),
      groupName: resolvedFormState.groupName.trim(),
      description: resolvedFormState.description.trim(),
      isActive: resolvedFormState.isActive,
    }

    if (!trimmed.groupCode || !trimmed.groupName) {
      setErrorMessage('필수 입력값(그룹 코드, 그룹 이름)을 모두 채워주세요.')
      return
    }

    const request: GroupUpsertRequest = {
      groupCode: trimmed.groupCode,
      groupName: trimmed.groupName,
      description: trimmed.description.length > 0 ? trimmed.description : null,
      isActive: trimmed.isActive,
    }

    try {
      if (mode === 'create') {
        await createGroupMutation.mutateAsync(request)
      } else {
        if (targetGroupId === null) {
          setErrorMessage('수정 대상 그룹을 확인할 수 없습니다.')
          return
        }
        await updateGroupMutation.mutateAsync({ groupId: targetGroupId, request })
      }
      setDraftFormState({})
      onClose()
    } catch (error) {
      if (error instanceof GroupApiError) {
        setErrorMessage(error.payload.errorMsg)
        return
      }
      setErrorMessage('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? handleClose() : null)}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '그룹 등록' : '그룹 수정'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '새 그룹을 등록합니다. 그룹 코드는 시스템 전체에서 유일해야 합니다.'
              : '그룹 정보를 수정합니다. 그룹 코드는 수정할 수 없습니다.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="group-upsert-code" className="text-xs font-semibold text-muted-foreground">
              그룹 코드
            </label>
            <Input
              id="group-upsert-code"
              value={resolvedFormState.groupCode}
              onChange={(event) => handleChange('groupCode', event.target.value)}
              disabled={isBusy || mode === 'edit'}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="group-upsert-name" className="text-xs font-semibold text-muted-foreground">
              그룹 이름
            </label>
            <Input
              id="group-upsert-name"
              value={resolvedFormState.groupName}
              onChange={(event) => handleChange('groupName', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label htmlFor="group-upsert-description" className="text-xs font-semibold text-muted-foreground">
              설명
            </label>
            <Input
              id="group-upsert-description"
              value={resolvedFormState.description}
              onChange={(event) => handleChange('description', event.target.value)}
              disabled={isBusy}
              placeholder="(선택)"
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="group-upsert-is-active"
              type="checkbox"
              checked={resolvedFormState.isActive}
              onChange={(event) => handleChange('isActive', event.target.checked)}
              disabled={isBusy}
              className="size-4 rounded border-input"
            />
            <label htmlFor="group-upsert-is-active" className="text-xs text-muted-foreground">
              활성화 (사용자에게 부여 가능)
            </label>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isBusy}>
            취소
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isBusy}
            data-testid="group-upsert-submit"
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {mode === 'create' ? '등록' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
