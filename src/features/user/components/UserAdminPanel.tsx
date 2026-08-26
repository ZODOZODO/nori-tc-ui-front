import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

  const userListQuery = useUsers(listOffset, USER_PAGE_SIZE)

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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
      {/* 제목(h1)과 설명은 라우트 헤딩(AppPageHeading)이 그린다 — 한 화면에 같은 문장을 두 번 두지
          않는다. 이 줄은 총건수 / 액션만 담당한다. 좌우 여백도 페이지 shell 이 소유한다. */}
      <div className="flex shrink-0 items-start justify-end gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="tabular-nums">
            {(userListQuery.data?.count ?? 0).toLocaleString()}
          </Badge>
          <Button type="button" data-testid="user-create-button" onClick={() => openCreateModal()}>
            {t('user.create')}
          </Button>
        </div>
      </div>

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
