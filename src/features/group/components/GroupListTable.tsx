import { Pencil, Trash2, Users } from 'lucide-react'
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
import { useGroups } from '../hooks/useGroups'
import { useGroupUiStore } from '../stores/group-ui.store'

export const GROUP_PAGE_SIZE = 20

interface GroupListTableProps {
  onSelectGroup: (groupId: number) => void
}

/**
 * Group 페이지의 그룹 목록 테이블입니다.
 * - 페이지네이션: Prev/Next 명시 (UserListTable 와 동일 패턴)
 * - 액션 컬럼: 수정 / 삭제 / 멤버 관리
 */
export function GroupListTable({ onSelectGroup }: GroupListTableProps) {
  const listOffset = useGroupUiStore((state) => state.listOffset)
  const activeGroupId = useGroupUiStore((state) => state.activeGroupId)
  const setListOffset = useGroupUiStore((state) => state.setListOffset)
  const openEditModal = useGroupUiStore((state) => state.openEditModal)
  const openDeleteDialog = useGroupUiStore((state) => state.openDeleteDialog)

  const groupListQuery = useGroups(listOffset, GROUP_PAGE_SIZE)

  const items = groupListQuery.data?.items ?? []
  const totalCount = groupListQuery.data?.count ?? 0
  const currentPage = Math.floor(listOffset / GROUP_PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(totalCount / GROUP_PAGE_SIZE))
  const canGoPrev = listOffset > 0
  const canGoNext = listOffset + GROUP_PAGE_SIZE < totalCount

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[#E2E9E4] bg-white">
      <div className="overflow-x-auto" data-testid="group-list-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>groupCode</TableHead>
              <TableHead>groupName</TableHead>
              <TableHead>description</TableHead>
              <TableHead>isActive</TableHead>
              <TableHead>updatedAt</TableHead>
              <TableHead className="text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-[#5D6963]">
                  {groupListQuery.isLoading ? '그룹 목록을 불러오는 중...' : '표시할 그룹이 없습니다.'}
                </TableCell>
              </TableRow>
            ) : (
              items.map((group) => {
                const isActive = activeGroupId === group.groupId
                return (
                  <TableRow
                    key={group.groupId}
                    data-testid={`group-row-${group.groupId}`}
                    data-active={isActive ? 'true' : 'false'}
                    onClick={() => onSelectGroup(group.groupId)}
                    className={`cursor-pointer ${isActive ? 'bg-[#EAF3EE]' : ''}`}
                  >
                    <TableCell className="font-medium text-[#1F2D26]">{group.groupCode}</TableCell>
                    <TableCell>{group.groupName}</TableCell>
                    <TableCell className="text-xs text-[#5C6A63]">{group.description ?? ''}</TableCell>
                    <TableCell>
                      <Badge variant={group.isActive ? 'default' : 'secondary'}>
                        {group.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-[#5C6A63]">
                      {group.updatedAt}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`그룹 ${group.groupCode} 멤버 관리`}
                          data-testid={`group-row-members-${group.groupId}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelectGroup(group.groupId)
                          }}
                        >
                          <Users className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`그룹 ${group.groupCode} 수정`}
                          data-testid={`group-row-edit-${group.groupId}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openEditModal(group.groupId)
                          }}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`그룹 ${group.groupCode} 삭제`}
                          data-testid={`group-row-delete-${group.groupId}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            openDeleteDialog(group.groupId)
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
        <span data-testid="group-list-pagination-summary">
          총 {totalCount}건 · {currentPage} / {totalPages} 페이지
        </span>
        <div className="flex items-center gap-2">
          {groupListQuery.isFetching ? <span>동기화 중...</span> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoPrev}
            data-testid="group-list-prev"
            onClick={() => setListOffset(Math.max(0, listOffset - GROUP_PAGE_SIZE))}
          >
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGoNext}
            data-testid="group-list-next"
            onClick={() => setListOffset(listOffset + GROUP_PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
