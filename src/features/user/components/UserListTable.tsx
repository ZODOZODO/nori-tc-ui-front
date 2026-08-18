import { useMemo } from 'react'
import { KeyRound, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableRow } from '@/components/ui/table'
import {
  SelectableTable,
  type ColumnDef,
  type SelectableTableActionColumn,
} from '@/shared/components/SelectableTable'
import { TableSectionHeader } from '@/shared/layout/TableSectionHeader'
import { useI18n } from '@/i18n/i18n-context'
import { useUsers } from '../hooks/useUsers'
import { useUserUiStore } from '../stores/user-ui.store'
import type { UserListItem } from '../types/user.types'

export const USER_PAGE_SIZE = 20

/**
 * User 페이지의 사용자 목록 테이블입니다.
 * - 컬럼: userId / userName / group(chip) / company / department / 액션
 * - 그룹 소속 추가/제거는 Group 페이지에서 관리합니다 (여기는 표시만).
 * - 페이지네이션: Prev/Next 명시 (DeployMonitorPanel 와 동일 패턴)
 * - 액션 컬럼: 수정 / 삭제 / 비밀번호 초기화
 * - 셀 영역 Ctrl+C → 클립보드 TSV (R4 SelectableTable rangeCopy)
 * - 행 더블클릭 → openEditModal (R4 W-UL1=A 결정 — Pencil 액션 보존)
 */
export function UserListTable() {
  const { t } = useI18n()
  const listOffset = useUserUiStore((state) => state.listOffset)
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

  const columns = useMemo<ColumnDef<UserListItem>[]>(
    () => [
      {
        key: 'userId',
        header: 'userId',
        accessor: (row) => row.userId,
      },
      {
        key: 'userName',
        header: 'userName',
        accessor: (row) => row.userName,
      },
      {
        key: 'group',
        header: 'group',
        accessor: (row) => row.groups.map((group) => group.groupCode).join('|'),
        renderCell: (row) =>
          row.groups.length === 0 ? (
            <span className="text-xs text-muted-foreground">-</span>
          ) : (
            <div className="flex flex-wrap gap-1" data-testid={`user-row-groups-${row.userPk}`}>
              {row.groups.map((group) => (
                <Badge
                  key={group.groupId}
                  variant="secondary"
                  data-testid={`user-row-group-${row.userPk}-${group.groupId}`}
                >
                  {group.groupCode}
                </Badge>
              ))}
            </div>
          ),
      },
      {
        key: 'company',
        header: 'company',
        accessor: (row) => row.company,
      },
      {
        key: 'department',
        header: 'department',
        accessor: (row) => row.department,
      },
    ],
    [],
  )

  const actionColumn = useMemo<SelectableTableActionColumn<UserListItem>>(
    () => ({
      header: t('user.table.action'),
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('user.aria.edit', { userId: row.userId })}
            data-testid={`user-row-edit-${row.userPk}`}
            onClick={() => openEditModal(row.userPk)}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('user.aria.resetPassword', { userId: row.userId })}
            data-testid={`user-row-reset-${row.userPk}`}
            onClick={() => openPasswordResetModal(row.userPk)}
          >
            <KeyRound className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('user.aria.delete', { userId: row.userId })}
            data-testid={`user-row-delete-${row.userPk}`}
            onClick={() => openDeleteDialog(row.userPk)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    }),
    [t, openEditModal, openPasswordResetModal, openDeleteDialog],
  )

  const isInitialLoading = userListQuery.isLoading && items.length === 0

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card">
      <TableSectionHeader
        title={t('user.table.title')}
        count={totalCount}
        className="px-4 pt-4"
      />
      <div className="overflow-x-auto" data-testid="user-list-table">
        <SelectableTable
          columns={columns}
          rows={items}
          rowKey={(row) => row.userPk}
          actionColumn={actionColumn}
          features={{ rangeCopy: true }}
          testId="selectable-table-user-list"
          emptyState={t('user.table.empty')}
          isLoading={isInitialLoading}
          skeletonRowCount={USER_PAGE_SIZE}
          wrapRow={(user, _rowIdx, children) => (
            <TableRow
              data-testid={`user-row-${user.userPk}`}
              onDoubleClick={() => openEditModal(user.userPk)}
              className="cursor-pointer"
            >
              {children}
            </TableRow>
          )}
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-6 py-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <span data-testid="user-list-pagination-summary">
          {t('deploy.monitor.pagination', {
            count: totalCount,
            page: currentPage,
            total: totalPages,
          })}
        </span>
        <div className="flex items-center gap-2">
          {userListQuery.isFetching ? <span>{t('user.table.syncing')}</span> : null}
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
