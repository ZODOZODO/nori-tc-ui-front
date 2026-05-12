import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useMe } from '@/features/profile/hooks/useProfile'
import { UserProfileModal } from '@/features/profile/components/UserProfileModal'
import { AppPageShell } from '@/shared/components/AppPageShell'
import { hasPermission, USER_READ_PERMISSION } from '@/shared/lib/permission'
import { useGroupUiStore } from '../stores/group-ui.store'
import { useGroups } from '../hooks/useGroups'
import { GROUP_PAGE_SIZE, GroupListTable } from './GroupListTable'
import { GroupDeleteConfirmDialog } from './GroupDeleteConfirmDialog'
import { GroupMemberPanel } from './GroupMemberPanel'
import { GroupUpsertModal } from './GroupUpsertModal'

const FORBIDDEN_FALLBACK_ROUTE = '/login'

/**
 * `/group` 라우트 페이지입니다. USER_READ 권한 없는 사용자는 /login 으로 리다이렉트됩니다.
 */
export function GroupPage() {
  const meQuery = useMe(true)
  const isProfileModalOpen = useGroupUiStore((state) => state.isProfileModalOpen)
  const setProfileModalOpen = useGroupUiStore((state) => state.setProfileModalOpen)
  const listOffset = useGroupUiStore((state) => state.listOffset)
  const activeGroupId = useGroupUiStore((state) => state.activeGroupId)
  const selectGroup = useGroupUiStore((state) => state.selectGroup)
  const isUpsertModalOpen = useGroupUiStore((state) => state.isUpsertModalOpen)
  const upsertMode = useGroupUiStore((state) => state.upsertMode)
  const isDeleteDialogOpen = useGroupUiStore((state) => state.isDeleteDialogOpen)
  const pendingDeleteGroupId = useGroupUiStore((state) => state.pendingDeleteGroupId)
  const openCreateModal = useGroupUiStore((state) => state.openCreateModal)
  const closeUpsertModal = useGroupUiStore((state) => state.closeUpsertModal)
  const closeDeleteDialog = useGroupUiStore((state) => state.closeDeleteDialog)

  const groupListQuery = useGroups(listOffset, GROUP_PAGE_SIZE)

  const activeGroupRow = useMemo(() => {
    if (activeGroupId === null) {
      return null
    }
    return groupListQuery.data?.items.find((group) => group.groupId === activeGroupId) ?? null
  }, [activeGroupId, groupListQuery.data?.items])

  const pendingDeleteGroupRow = useMemo(() => {
    if (pendingDeleteGroupId === null) {
      return null
    }
    return (
      groupListQuery.data?.items.find((group) => group.groupId === pendingDeleteGroupId) ?? null
    )
  }, [pendingDeleteGroupId, groupListQuery.data?.items])

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6FBF8] text-sm text-[#4B5A52]">
        사용자 정보를 확인하는 중입니다.
      </div>
    )
  }

  if (!hasPermission(meQuery.data?.permissionCodes, USER_READ_PERMISSION)) {
    return <Navigate to={FORBIDDEN_FALLBACK_ROUTE} replace />
  }

  return (
    <AppPageShell
      currentMenu="group"
      onOpenProfile={() => setProfileModalOpen(true)}
      onAfterLogout={() => setProfileModalOpen(false)}
    >
      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2D26]">그룹 관리</h1>
            <p className="text-xs text-[#6C7872]">
              사용자 권한 그룹을 등록 / 수정 / 삭제하고 멤버를 관리합니다.
            </p>
          </div>
          <Button type="button" data-testid="group-create-button" onClick={() => openCreateModal()}>
            그룹 등록
          </Button>
        </header>

        <GroupListTable onSelectGroup={(groupId) => selectGroup(groupId)} />

        <section
          className="flex flex-col gap-3 rounded-[18px] border border-[#E2E9E4] bg-white p-4"
          data-testid="group-detail-panel"
        >
          <header>
            <h2 className="text-sm font-semibold text-[#1F2D26]">그룹 멤버</h2>
            <p className="text-xs text-[#6C7872]">
              {activeGroupRow
                ? `${activeGroupRow.groupCode} (${activeGroupRow.groupName}) 의 멤버를 관리합니다.`
                : '그룹 행을 클릭하면 멤버 관리를 시작할 수 있습니다.'}
            </p>
          </header>
          <GroupMemberPanel
            groupId={activeGroupId}
            groupCode={activeGroupRow?.groupCode ?? null}
          />
        </section>
      </main>

      <GroupUpsertModal
        open={isUpsertModalOpen}
        mode={upsertMode}
        targetGroupId={upsertMode === 'edit' ? activeGroupId : null}
        onClose={closeUpsertModal}
      />
      <GroupDeleteConfirmDialog
        open={isDeleteDialogOpen}
        targetGroupId={pendingDeleteGroupId}
        targetGroupCode={pendingDeleteGroupRow?.groupCode ?? null}
        onClose={closeDeleteDialog}
      />
      <UserProfileModal open={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </AppPageShell>
  )
}
