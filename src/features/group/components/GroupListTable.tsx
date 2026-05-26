import { useMemo } from 'react'
import { Pencil, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  SelectableTable,
  type ColumnDef,
  type SelectableTableActionColumn,
} from '@/shared/components/SelectableTable'
import { useGroups } from '../hooks/useGroups'
import { useGroupUiStore } from '../stores/group-ui.store'
import type { GroupInfo } from '../types/group.types'

export const GROUP_PAGE_SIZE = 20
const GROUP_TABLE_COLUMN_COUNT = 6

/**
 * Group 페이지의 그룹 목록 테이블입니다.
 * - 페이지네이션: Prev/Next 명시 (UserListTable 와 동일 패턴)
 * - 액션 컬럼: 사용자 추가 / 수정 / 삭제
 * - 셀 영역 Ctrl+C → 클립보드 TSV (R4 SelectableTable rangeCopy)
 * - 행 더블클릭 → openEditModal (R4 W-GL1=A 결정 — Pencil 액션 보존)
 */
export function GroupListTable() {
  const listOffset = useGroupUiStore((state) => state.listOffset)
  const setListOffset = useGroupUiStore((state) => state.setListOffset)
  const openEditModal = useGroupUiStore((state) => state.openEditModal)
  const openDeleteDialog = useGroupUiStore((state) => state.openDeleteDialog)
  const openAddMembersModal = useGroupUiStore((state) => state.openAddMembersModal)

  const groupListQuery = useGroups(listOffset, GROUP_PAGE_SIZE)

  const items = groupListQuery.data?.items ?? []
  const totalCount = groupListQuery.data?.count ?? 0
  const currentPage = Math.floor(listOffset / GROUP_PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(totalCount / GROUP_PAGE_SIZE))
  const canGoPrev = listOffset > 0
  const canGoNext = listOffset + GROUP_PAGE_SIZE < totalCount

  const columns = useMemo<ColumnDef<GroupInfo>[]>(
    () => [
      {
        key: 'groupCode',
        header: 'groupCode',
        accessor: (row) => row.groupCode,
      },
      {
        key: 'groupName',
        header: 'groupName',
        accessor: (row) => row.groupName,
      },
      {
        key: 'description',
        header: 'description',
        accessor: (row) => row.description ?? '',
      },
      {
        key: 'isActive',
        header: 'isActive',
        accessor: (row) => (row.isActive ? 'ACTIVE' : 'INACTIVE'),
        renderCell: (row) => (
          <Badge variant={row.isActive ? 'default' : 'secondary'}>
            {row.isActive ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
        ),
      },
      {
        key: 'updatedAt',
        header: 'updatedAt',
        accessor: (row) => row.updatedAt,
      },
    ],
    [],
  )

  const actionColumn = useMemo<SelectableTableActionColumn<GroupInfo>>(
    () => ({
      header: '액션',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`그룹 ${row.groupCode} 사용자 추가`}
            data-testid={`group-row-members-${row.groupId}`}
            onClick={() => openAddMembersModal(row.groupId)}
          >
            <Users className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`그룹 ${row.groupCode} 수정`}
            data-testid={`group-row-edit-${row.groupId}`}
            onClick={() => openEditModal(row.groupId)}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`그룹 ${row.groupCode} 삭제`}
            data-testid={`group-row-delete-${row.groupId}`}
            onClick={() => openDeleteDialog(row.groupId)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    }),
    [openAddMembersModal, openEditModal, openDeleteDialog],
  )

  const isInitialLoading = groupListQuery.isLoading && items.length === 0

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[#E2E9E4] bg-white">
      <div className="overflow-x-auto" data-testid="group-list-table">
        {isInitialLoading ? (
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
              {Array.from({ length: GROUP_PAGE_SIZE }).map((_, rowIndex) => (
                <TableRow key={`group-skeleton-${rowIndex}`} data-testid="group-row-skeleton">
                  {Array.from({ length: GROUP_TABLE_COLUMN_COUNT }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <SelectableTable
            columns={columns}
            rows={items}
            rowKey={(row) => row.groupId}
            actionColumn={actionColumn}
            features={{ rangeCopy: true }}
            testId="selectable-table-group-list"
            emptyState="표시할 그룹이 없습니다."
            wrapRow={(group, _rowIdx, children) => (
              <TableRow
                data-testid={`group-row-${group.groupId}`}
                onDoubleClick={() => openEditModal(group.groupId)}
                className="cursor-pointer"
              >
                {children}
              </TableRow>
            )}
          />
        )}
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
