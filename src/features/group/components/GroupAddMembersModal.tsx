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
import { useAllUsers } from '@/features/user/hooks/useUsers'
import { useAddGroupMember, useRemoveGroupMember } from '../hooks/useGroupMutations'
import { useGroupMembers } from '../hooks/useGroups'
import { GroupApiError } from '../types/group.types'

interface GroupAddMembersModalProps {
  open: boolean
  groupId: number | null
  groupCode: string | null
  onClose: () => void
}

interface AddResultSummary {
  added: number
  failed: number
  firstErrorMessage: string | null
}

/**
 * 그룹에 사용자를 추가하는 모달입니다.
 *
 * - 전체 사용자 목록을 `useAllUsers` 로 가져오고, 이미 그룹 멤버인 사용자는 disabled 체크박스로 표시
 * - 검색 input 으로 userId/userName 필터링 (대소문자 무시)
 * - "추가" → 선택된 미가입 userPk 들에 대해 `Promise.allSettled` 로 병렬 POST
 * - 결과를 요약 메시지로 표시 (실패가 있으면 첫 에러 메시지도 함께)
 */
export function GroupAddMembersModal({ open, groupId, groupCode, onClose }: GroupAddMembersModalProps) {
  const allUsersQuery = useAllUsers(open)
  const groupMembersQuery = useGroupMembers(groupId, open && groupId !== null)
  const addMemberMutation = useAddGroupMember()
  const removeMemberMutation = useRemoveGroupMember()

  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedUserPks, setSelectedUserPks] = useState<ReadonlySet<number>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resultSummary, setResultSummary] = useState<AddResultSummary | null>(null)

  // 모달이 닫히면 다음 오픈을 위해 입력 상태를 초기화한다. effect 대신 render 중
  // prop 변화 감지로 처리 — cascading render 회피 (react-hooks/set-state-in-effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setSearchKeyword('')
      setSelectedUserPks(new Set())
      setErrorMessage(null)
      setResultSummary(null)
    }
  }

  const existingMemberUserPks = useMemo<ReadonlySet<number>>(() => {
    const items = groupMembersQuery.data?.items ?? []
    return new Set(items.map((member) => member.userPk))
  }, [groupMembersQuery.data?.items])

  const filteredUsers = useMemo(() => {
    const allUsers = allUsersQuery.data ?? []
    const keyword = searchKeyword.trim().toLowerCase()
    if (keyword.length === 0) {
      return allUsers
    }
    return allUsers.filter(
      (user) =>
        user.userId.toLowerCase().includes(keyword) ||
        user.userName.toLowerCase().includes(keyword),
    )
  }, [allUsersQuery.data, searchKeyword])

  const toggleSelection = (userPk: number) => {
    setSelectedUserPks((previous) => {
      const next = new Set(previous)
      if (next.has(userPk)) {
        next.delete(userPk)
      } else {
        next.add(userPk)
      }
      return next
    })
  }

  const isBusy = addMemberMutation.isPending || removeMemberMutation.isPending
  const isLoading = allUsersQuery.isLoading || groupMembersQuery.isLoading

  const handleRemove = async (userPk: number) => {
    if (groupId === null) {
      setErrorMessage('대상 그룹을 확인할 수 없습니다.')
      return
    }
    setErrorMessage(null)
    setResultSummary(null)
    try {
      await removeMemberMutation.mutateAsync({ userPk, groupId })
    } catch (error) {
      setErrorMessage(
        error instanceof GroupApiError ? error.payload.errorMsg : '그룹 멤버 제거에 실패했습니다.',
      )
    }
  }

  const handleClose = () => {
    if (isBusy) {
      return
    }
    onClose()
  }

  const handleSubmit = async () => {
    setErrorMessage(null)
    setResultSummary(null)

    if (groupId === null) {
      setErrorMessage('대상 그룹을 확인할 수 없습니다.')
      return
    }
    const targetUserPks = Array.from(selectedUserPks).filter(
      (userPk) => !existingMemberUserPks.has(userPk),
    )
    if (targetUserPks.length === 0) {
      setErrorMessage('추가할 사용자를 선택해 주세요.')
      return
    }

    const settleResults = await Promise.allSettled(
      targetUserPks.map((userPk) => addMemberMutation.mutateAsync({ userPk, groupId })),
    )

    let added = 0
    let failed = 0
    let firstErrorMessage: string | null = null
    settleResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        added += 1
      } else {
        failed += 1
        if (firstErrorMessage === null) {
          firstErrorMessage =
            result.reason instanceof GroupApiError
              ? result.reason.payload.errorMsg
              : '그룹 멤버 추가에 실패했습니다.'
        }
      }
    })

    setResultSummary({ added, failed, firstErrorMessage })
    if (failed === 0) {
      setSelectedUserPks(new Set())
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? handleClose() : null)}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>그룹 멤버 추가</DialogTitle>
          <DialogDescription>
            {groupCode
              ? `${groupCode} 그룹에 추가할 사용자를 선택하세요.`
              : '대상 그룹을 확인하세요.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            placeholder="userId 또는 이름으로 검색"
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            disabled={isLoading || isBusy}
            data-testid="group-add-members-search"
          />

          <div
            className="flex max-h-[320px] flex-col gap-1 overflow-y-auto rounded-md border border-border p-2"
            data-testid="group-add-members-list"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                사용자 목록을 불러오는 중...
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                표시할 사용자가 없습니다.
              </p>
            ) : (
              filteredUsers.map((user) => {
                const isAlreadyMember = existingMemberUserPks.has(user.userPk)
                const isSelected = selectedUserPks.has(user.userPk)
                return (
                  <label
                    key={user.userPk}
                    className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm ${
                      isAlreadyMember ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted'
                    }`}
                    data-testid={`group-add-members-row-${user.userPk}`}
                  >
                    <input
                      type="checkbox"
                      checked={isAlreadyMember || isSelected}
                      disabled={isAlreadyMember || isBusy}
                      onChange={() => toggleSelection(user.userPk)}
                      data-testid={`group-add-members-checkbox-${user.userPk}`}
                    />
                    <span className="flex-1">
                      <span className="font-medium text-foreground">{user.userId}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {user.userName} · {user.company} · {user.department}
                      </span>
                    </span>
                    {isAlreadyMember ? (
                      <button
                        type="button"
                        onClick={() => void handleRemove(user.userPk)}
                        disabled={isBusy}
                        className="rounded-md border border-danger/40 px-2 py-0.5 text-xs font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid={`group-member-remove-${user.userPk}`}
                      >
                        멤버 제거
                      </button>
                    ) : null}
                  </label>
                )
              })
            )}
          </div>

          {errorMessage ? (
            <p
              className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"
              data-testid="group-add-members-error"
            >
              {errorMessage}
            </p>
          ) : null}

          {resultSummary ? (
            <p
              className="rounded-md border border-success/20 bg-success/5 px-3 py-2 text-sm text-success"
              data-testid="group-add-members-result"
            >
              추가 {resultSummary.added}건 / 실패 {resultSummary.failed}건
              {resultSummary.firstErrorMessage ? ` — 첫 오류: ${resultSummary.firstErrorMessage}` : ''}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isBusy}>
            닫기
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isBusy || isLoading || selectedUserPks.size === 0}
            data-testid="group-add-members-submit"
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
