import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAddUserGroup, useRemoveUserGroup, useUserGroups } from '../hooks/useUserGroups'
import { UserApiError } from '../types/user.types'

interface UserGroupChipListProps {
  userPk: number | null
}

/**
 * 사용자 상세 패널에 표시되는 그룹 칩 리스트입니다.
 * - GET /api/user/{userPk}/group 결과를 칩으로 표시
 * - 칩 X 버튼으로 DELETE /api/user/{userPk}/group/{groupId}
 * - 그룹 ID 입력 + 추가 버튼으로 POST /api/user/{userPk}/group/{groupId}
 *
 * 본 라운드(User-AC-13) 범위에서는 "표시 + 제거" 만 e2e 로 검증합니다.
 * 그룹 추가 UX 의 풀 셀렉트(검색 가능) 는 Group 라운드에서 GroupListTable 과 연동될 때 채워집니다.
 */
export function UserGroupChipList({ userPk }: UserGroupChipListProps) {
  const userGroupsQuery = useUserGroups(userPk, userPk !== null)
  const removeUserGroupMutation = useRemoveUserGroup()
  const addUserGroupMutation = useAddUserGroup()
  const [pendingRemoveGroupId, setPendingRemoveGroupId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [draftGroupIdInput, setDraftGroupIdInput] = useState('')

  const handleRemove = async (groupId: number) => {
    if (userPk === null) {
      return
    }
    setErrorMessage(null)
    setPendingRemoveGroupId(groupId)
    try {
      await removeUserGroupMutation.mutateAsync({ userPk, groupId })
    } catch (error) {
      setErrorMessage(
        error instanceof UserApiError ? error.payload.errorMsg : '그룹 제거에 실패했습니다.',
      )
    } finally {
      setPendingRemoveGroupId(null)
    }
  }

  const handleAdd = async () => {
    if (userPk === null) {
      return
    }
    const parsed = Number(draftGroupIdInput.trim())
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setErrorMessage('그룹 ID는 양의 정수여야 합니다.')
      return
    }
    setErrorMessage(null)
    try {
      await addUserGroupMutation.mutateAsync({ userPk, groupId: parsed })
      setDraftGroupIdInput('')
    } catch (error) {
      setErrorMessage(
        error instanceof UserApiError ? error.payload.errorMsg : '그룹 추가에 실패했습니다.',
      )
    }
  }

  if (userPk === null) {
    return (
      <p className="text-sm text-[#5D6963]" data-testid="user-group-chip-empty">
        사용자를 선택하면 소속 그룹이 표시됩니다.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3" data-testid="user-group-chip-list">
      <div className="flex flex-wrap items-center gap-2">
        {userGroupsQuery.isLoading ? (
          <span className="flex items-center gap-1 text-xs text-[#5D6963]">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            그룹 정보를 불러오는 중...
          </span>
        ) : (userGroupsQuery.data?.items.length ?? 0) === 0 ? (
          <span className="text-xs text-[#7F8A84]">소속 그룹이 없습니다.</span>
        ) : (
          userGroupsQuery.data?.items.map((mapping) => (
            <span
              key={mapping.groupId}
              data-testid={`user-group-chip-${mapping.groupId}`}
              className="inline-flex items-center gap-1 rounded-full border border-[#CFE1D8] bg-[#EAF3EE] px-3 py-1 text-xs text-[#2D5543]"
            >
              <span>
                {mapping.groupCode} · {mapping.groupName}
              </span>
              <button
                type="button"
                onClick={() => void handleRemove(mapping.groupId)}
                disabled={pendingRemoveGroupId === mapping.groupId}
                aria-label={`그룹 ${mapping.groupCode} 제거`}
                data-testid={`user-group-chip-remove-${mapping.groupId}`}
                className="flex size-4 items-center justify-center rounded-full text-[#5C6A63] hover:bg-white"
              >
                {pendingRemoveGroupId === mapping.groupId ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <X className="size-3" aria-hidden="true" />
                )}
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={draftGroupIdInput}
          onChange={(event) => setDraftGroupIdInput(event.target.value)}
          placeholder="추가할 그룹 ID"
          className="h-9 w-32 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm"
          data-testid="user-group-add-input"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={addUserGroupMutation.isPending || draftGroupIdInput.trim().length === 0}
          onClick={() => void handleAdd()}
          data-testid="user-group-add-submit"
        >
          {addUserGroupMutation.isPending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : null}
          그룹 추가
        </Button>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-xs text-[#B4483F]">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
