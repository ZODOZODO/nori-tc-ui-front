import { KeyRound, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useUsers } from '../hooks/useUsers'
import { useUserUiStore } from '../stores/user-ui.store'

export const USER_PAGE_SIZE = 20

interface UserListTableProps {
  onSelectUser: (userPk: number) => void
}

/**
 * User 페이지의 사용자 목록 테이블입니다.
 * - 페이지네이션: Prev/Next 명시 (DeployMonitorPanel 와 동일 패턴)
 * - 액션 컬럼: 수정 / 삭제 / 비밀번호 초기화
 */
export function UserListTable({ onSelectUser }: UserListTableProps) {
  const listOffset = useUserUiStore((state) => state.listOffset)
  const activeUserPk = useUserUiStore((state) => state.activeUserPk)
  const setListOffset = useUserUiStore((state) => state.setListOffset)
  const openEditModal = useUserUiStore((state) => state.openEditModal)
  const openDeleteDialog = useUserUiStore((state) => state.openDeleteDialog)
  const openPasswordResetModal = useUserUiStore((state) => state.openPasswordResetModal)

  const userListQuery = useUsers(listOffset, USER_PAGE_SIZE)

  const items = userListQuery.data?.items ?? []
  const totalCount = userListQuery.data?.count ?? 0
  const currentPage = Math.floor(listOffset / USER_PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(totalCount / USER_PAGE_SIZE))
  const canGoPrev = listOffset > 0
  const canGoNext = listOffset + USER_PAGE_SIZE < totalCount

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[#E2E9E4] bg-white">
      <div className="overflow-x-auto" data-testid="user-list-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>userId</TableHead>
              <TableHead>userName</TableHead>
              <TableHead>company</TableHead>
              <TableHead>department</TableHead>
              <TableHead>email</TableHead>
              <TableHead>status</TableHead>
              <TableHead>updatedAt</TableHead>
              <TableHead className="text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-[#5D6963]">
                  {userListQuery.isLoading ? '사용자 목록을 불러오는 중...' : '표시할 사용자가 없습니다.'}
                </TableCell>
              </TableRow>
            ) : (
              items.map((user) => {
                const isActive = activeUserPk === user.userPk
                return (
                  <TableRow
                    key={user.userPk}
                    data-testid={`user-row-${user.userPk}`}
                    data-active={isActive ? 'true' : 'false'}
                    onClick={() => onSelectUser(user.userPk)}
                    className={`cursor-pointer ${isActive ? 'bg-[#EAF3EE]' : ''}`}
                  >
                    <TableCell className="font-medium text-[#1F2D26]">{user.userId}</TableCell>
                    <TableCell>{user.userName}</TableCell>
                    <TableCell>{user.company}</TableCell>
                    <TableCell>{user.department}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-[#5C6A63]">
                      {user.updatedAt}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`사용자 ${user.userId} 수정`}
                          data-testid={`user-row-edit-${user.userPk}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openEditModal(user.userPk)
                          }}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`사용자 ${user.userId} 비밀번호 초기화`}
                          data-testid={`user-row-reset-${user.userPk}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openPasswordResetModal(user.userPk)
                          }}
                        >
                          <KeyRound className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`사용자 ${user.userId} 삭제`}
                          data-testid={`user-row-delete-${user.userPk}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openDeleteDialog(user.userPk)
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#EDF1EE] px-6 py-3 text-xs text-[#5C6A63] md:flex-row md:items-center md:justify-between">
        <span data-testid="user-list-pagination-summary">
          총 {totalCount}건 · {currentPage} / {totalPages} 페이지
        </span>
        <div className="flex items-center gap-2">
          {userListQuery.isFetching ? <span>동기화 중...</span> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoPrev}
            data-testid="user-list-prev"
            onClick={() => setListOffset(Math.max(0, listOffset - USER_PAGE_SIZE))}
          >
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoNext}
            data-testid="user-list-next"
            onClick={() => setListOffset(listOffset + USER_PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
