import { useMemo } from 'react'
import { CircleAlert, CircleCheck, Plus, UserRound, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageMetricGrid } from '@/shared/layout/PageMetricGrid'
import { TableSectionHeader } from '@/shared/layout/TableSectionHeader'
import { useI18n } from '@/i18n/i18n-context'
import { useUsers } from '../hooks/useUsers'
import { useUserUiStore } from '../stores/user-ui.store'
import { UserDeleteConfirmDialog } from './UserDeleteConfirmDialog'
import { USER_PAGE_SIZE, UserListTable } from './UserListTable'
import { UserPasswordResetModal } from './UserPasswordResetModal'
import { UserUpsertModal } from './UserUpsertModal'

export function UserAdminPanel() {
  const { t } = useI18n()
  const listOffset = useUserUiStore((state) => state.listOffset)
  const activeUserPk = useUserUiStore((state) => state.activeUserPk)
  const isUpsertModalOpen = useUserUiStore((state) => state.isUpsertModalOpen)
  const upsertMode = useUserUiStore((state) => state.upsertMode)
  const isDeleteDialogOpen = useUserUiStore((state) => state.isDeleteDialogOpen)
  const pendingDeleteUserPk = useUserUiStore((state) => state.pendingDeleteUserPk)
  const isPasswordResetModalOpen = useUserUiStore((state) => state.isPasswordResetModalOpen)
  const passwordResetUserPk = useUserUiStore((state) => state.passwordResetUserPk)
  const openCreateModal = useUserUiStore((state) => state.openCreateModal)
  const closeUpsertModal = useUserUiStore((state) => state.closeUpsertModal)
  const closeDeleteDialog = useUserUiStore((state) => state.closeDeleteDialog)
  const closePasswordResetModal = useUserUiStore((state) => state.closePasswordResetModal)

  // 목록 테이블과 같은 파라미터로 호출해 쿼리 캐시를 공유한다(추가 요청 없음).
  const userListQuery = useUsers(listOffset, USER_PAGE_SIZE)
  const visibleUsers = userListQuery.data?.items ?? []
  const activeCount = visibleUsers.filter((user) => user.status === 'ACTIVE').length
  const attentionCount = visibleUsers.length - activeCount
  const groupAssignmentCount = visibleUsers.reduce((sum, user) => sum + user.groups.length, 0)

  const pendingDeleteUserRow = useMemo(() => {
    if (pendingDeleteUserPk === null) {
      return null
    }
    return userListQuery.data?.items.find((user) => user.userPk === pendingDeleteUserPk) ?? null
  }, [pendingDeleteUserPk, userListQuery.data?.items])

  const passwordResetUserRow = useMemo(() => {
    if (passwordResetUserPk === null) {
      return null
    }
    return userListQuery.data?.items.find((user) => user.userPk === passwordResetUserPk) ?? null
  }, [passwordResetUserPk, userListQuery.data?.items])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      {/* 페이지 제목(h1)은 /user 페이지가 갖는다 — 여기는 모드 섹션 제목(h2)이다. */}
      <TableSectionHeader
        title={t('user.title')}
        subtitle={t('user.description')}
        count={userListQuery.data?.count ?? 0}
        actions={
          <Button type="button" data-testid="user-create-button" onClick={() => openCreateModal()}>
            <Plus aria-hidden="true" />
            {t('user.create')}
          </Button>
        }
      />

      <PageMetricGrid
        ariaLabel={t('user.summary.ariaLabel')}
        items={[
          {
            key: 'TOTAL',
            label: t('user.summary.total'),
            value: userListQuery.data?.count ?? 0,
            icon: UserRound,
            tone: 'neutral',
          },
          {
            key: 'ACTIVE',
            label: t('user.summary.activeOnPage'),
            value: activeCount,
            icon: CircleCheck,
            tone: 'brand',
          },
          {
            key: 'ATTENTION',
            label: t('user.summary.attentionOnPage'),
            value: attentionCount,
            icon: CircleAlert,
            tone: 'warning',
          },
          {
            key: 'GROUPS',
            label: t('user.summary.groupAssignmentsOnPage'),
            value: groupAssignmentCount,
            icon: UsersRound,
            tone: 'neutral',
          },
        ]}
      />

      <UserListTable />

      <UserUpsertModal
        open={isUpsertModalOpen}
        mode={upsertMode}
        targetUserPk={upsertMode === 'edit' ? activeUserPk : null}
        onClose={closeUpsertModal}
      />
      <UserDeleteConfirmDialog
        open={isDeleteDialogOpen}
        targetUserPk={pendingDeleteUserPk}
        targetUserId={pendingDeleteUserRow?.userId ?? null}
        onClose={closeDeleteDialog}
      />
      <UserPasswordResetModal
        open={isPasswordResetModalOpen}
        targetUserPk={passwordResetUserPk}
        targetUserId={passwordResetUserRow?.userId ?? null}
        onClose={closePasswordResetModal}
      />
    </div>
  )
}
