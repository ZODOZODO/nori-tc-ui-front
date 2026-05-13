import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useUsers } from '../hooks/useUsers'
import { useUserUiStore } from '../stores/user-ui.store'
import { UserDeleteConfirmDialog } from './UserDeleteConfirmDialog'
import { UserGroupChipList } from './UserGroupChipList'
import { USER_PAGE_SIZE, UserListTable } from './UserListTable'
import { UserPasswordResetModal } from './UserPasswordResetModal'
import { UserUpsertModal } from './UserUpsertModal'

export function UserAdminPanel() {
  const listOffset = useUserUiStore((state) => state.listOffset)
  const activeUserPk = useUserUiStore((state) => state.activeUserPk)
  const selectUser = useUserUiStore((state) => state.selectUser)
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

  const activeUserRow = useMemo(() => {
    if (activeUserPk === null) {
      return null
    }
    return userListQuery.data?.items.find((user) => user.userPk === activeUserPk) ?? null
  }, [activeUserPk, userListQuery.data?.items])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2D26]">사용자 관리</h1>
          <p className="text-xs text-[#6C7872]">
            시스템 사용자 계정을 등록 / 수정 / 삭제하고 그룹 소속을 관리합니다.
          </p>
        </div>
        <Button type="button" data-testid="user-create-button" onClick={() => openCreateModal()}>
          사용자 등록
        </Button>
      </header>

      <UserListTable onSelectUser={(userPk) => selectUser(userPk)} />

      <section
        className="flex flex-col gap-3 rounded-[18px] border border-[#E2E9E4] bg-white p-4"
        data-testid="user-detail-panel"
      >
        <header>
          <h2 className="text-sm font-semibold text-[#1F2D26]">사용자 소속 그룹</h2>
          <p className="text-xs text-[#6C7872]">
            {activeUserRow
              ? `${activeUserRow.userId} (${activeUserRow.userName}) 의 그룹 매핑을 관리합니다.`
              : '사용자 행을 클릭하면 소속 그룹 정보를 확인할 수 있습니다.'}
          </p>
        </header>
        <UserGroupChipList userPk={activeUserPk} />
      </section>

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
