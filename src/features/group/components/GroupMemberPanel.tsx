import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAddGroupMember, useRemoveGroupMember } from '../hooks/useGroupMutations'
import { GroupApiError } from '../types/group.types'

interface GroupMemberPanelProps {
  groupId: number | null
  groupCode: string | null
}

interface MemberRow {
  userPk: number
}

/**
 * 그룹 상세 패널의 멤버 관리 영역입니다.
 *
 * 백엔드 GET /api/group/{groupId}/user 가 존재하지 않으므로 멤버 목록은
 * 본 세션 동안 추가된 사용자 PK 만 클라이언트 상태로 보존합니다.
 * - 추가: POST /api/user/{userPk}/group/{groupId} 성공 시 칩에 추가
 * - 제거: DELETE /api/user/{userPk}/group/{groupId} 성공 시 칩에서 제거
 *
 * (그룹별 멤버 영속 표시는 후속 SPEC 의 백엔드 GET 추가가 필요합니다.)
 */
export function GroupMemberPanel({ groupId, groupCode }: GroupMemberPanelProps) {
  const addGroupMemberMutation = useAddGroupMember()
  const removeGroupMemberMutation = useRemoveGroupMember()
  const [members, setMembers] = useState<MemberRow[]>([])
  const [pendingRemoveUserPk, setPendingRemoveUserPk] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [draftUserPkInput, setDraftUserPkInput] = useState('')

  useEffect(() => {
    setMembers([])
    setErrorMessage(null)
    setDraftUserPkInput('')
  }, [groupId])

  const handleAdd = async () => {
    if (groupId === null) {
      return
    }
    const parsed = Number(draftUserPkInput.trim())
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setErrorMessage('사용자 PK는 양의 정수여야 합니다.')
      return
    }
    setErrorMessage(null)
    try {
      await addGroupMemberMutation.mutateAsync({ userPk: parsed, groupId })
      setMembers((previous) =>
        previous.some((row) => row.userPk === parsed)
          ? previous
          : [...previous, { userPk: parsed }],
      )
      setDraftUserPkInput('')
    } catch (error) {
      setErrorMessage(
        error instanceof GroupApiError ? error.payload.errorMsg : '그룹 멤버 추가에 실패했습니다.',
      )
    }
  }

  const handleRemove = async (userPk: number) => {
    if (groupId === null) {
      return
    }
    setErrorMessage(null)
    setPendingRemoveUserPk(userPk)
    try {
      await removeGroupMemberMutation.mutateAsync({ userPk, groupId })
      setMembers((previous) => previous.filter((row) => row.userPk !== userPk))
    } catch (error) {
      setErrorMessage(
        error instanceof GroupApiError ? error.payload.errorMsg : '그룹 멤버 제거에 실패했습니다.',
      )
    } finally {
      setPendingRemoveUserPk(null)
    }
  }

  if (groupId === null) {
    return (
      <p className="text-sm text-[#5D6963]" data-testid="group-member-empty">
        그룹을 선택하면 멤버 관리를 시작할 수 있습니다.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3" data-testid="group-member-panel">
      <p className="text-xs text-[#6C7872]">
        그룹 {groupCode ?? groupId} 의 멤버를 사용자 PK 기준으로 추가/제거합니다. 본 세션에서 추가한
        사용자만 화면에 표시됩니다.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {members.length === 0 ? (
          <span className="text-xs text-[#7F8A84]" data-testid="group-member-list-empty">
            본 세션에서 추가한 멤버가 없습니다.
          </span>
        ) : (
          members.map((row) => (
            <span
              key={row.userPk}
              data-testid={`group-member-chip-${row.userPk}`}
              className="inline-flex items-center gap-1 rounded-full border border-[#CFE1D8] bg-[#EAF3EE] px-3 py-1 text-xs text-[#2D5543]"
            >
              <span>userPk #{row.userPk}</span>
              <button
                type="button"
                onClick={() => void handleRemove(row.userPk)}
                disabled={pendingRemoveUserPk === row.userPk}
                aria-label={`사용자 #${row.userPk} 제거`}
                data-testid={`group-member-chip-remove-${row.userPk}`}
                className="flex size-4 items-center justify-center rounded-full text-[#5C6A63] hover:bg-white"
              >
                {pendingRemoveUserPk === row.userPk ? (
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
          value={draftUserPkInput}
          onChange={(event) => setDraftUserPkInput(event.target.value)}
          placeholder="추가할 사용자 PK"
          className="h-9 w-40 rounded-md border border-[#DCE5E0] bg-white px-2 text-sm"
          data-testid="group-member-add-input"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={addGroupMemberMutation.isPending || draftUserPkInput.trim().length === 0}
          onClick={() => void handleAdd()}
          data-testid="group-member-add-submit"
        >
          {addGroupMemberMutation.isPending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : null}
          멤버 추가
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
