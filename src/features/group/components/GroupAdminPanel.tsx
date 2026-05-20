import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useGroups } from '../hooks/useGroups'
import { useGroupUiStore } from '../stores/group-ui.store'
import { GroupAddMembersModal } from './GroupAddMembersModal'
import { GroupDeleteConfirmDialog } from './GroupDeleteConfirmDialog'
import { GROUP_PAGE_SIZE, GroupListTable } from './GroupListTable'
import { GroupUpsertModal } from './GroupUpsertModal'

export function GroupAdminPanel() {
  const listOffset = useGroupUiStore((state) => state.listOffset)
  const activeGroupId = useGroupUiStore((state) => state.activeGroupId)
  const isUpsertModalOpen = useGroupUiStore((state) => state.isUpsertModalOpen)
  const upsertMode = useGroupUiStore((state) => state.upsertMode)
  const isDeleteDialogOpen = useGroupUiStore((state) => state.isDeleteDialogOpen)
  const pendingDeleteGroupId = useGroupUiStore((state) => state.pendingDeleteGroupId)
  const isAddMembersModalOpen = useGroupUiStore((state) => state.isAddMembersModalOpen)
  const addMembersTargetGroupId = useGroupUiStore((state) => state.addMembersTargetGroupId)
  const openCreateModal = useGroupUiStore((state) => state.openCreateModal)
  const closeUpsertModal = useGroupUiStore((state) => state.closeUpsertModal)
  const closeDeleteDialog = useGroupUiStore((state) => state.closeDeleteDialog)
  const closeAddMembersModal = useGroupUiStore((state) => state.closeAddMembersModal)

  const groupListQuery = useGroups(listOffset, GROUP_PAGE_SIZE)

  const pendingDeleteGroupRow = useMemo(() => {
    if (pendingDeleteGroupId === null) {
      return null
    }
    return (
      groupListQuery.data?.items.find((group) => group.groupId === pendingDeleteGroupId) ?? null
    )
  }, [pendingDeleteGroupId, groupListQuery.data?.items])

  const addMembersTargetGroupRow = useMemo(() => {
    if (addMembersTargetGroupId === null) {
      return null
    }
    return (
      groupListQuery.data?.items.find((group) => group.groupId === addMembersTargetGroupId) ?? null
    )
  }, [addMembersTargetGroupId, groupListQuery.data?.items])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2D26]">그룹 관리</h1>
          <p className="text-xs text-[#6C7872]">
            사용자 권한 그룹을 등록 / 수정 / 삭제하고 행의 사용자 버튼으로 멤버를 추가합니다.
          </p>
        </div>
        <Button type="button" data-testid="group-create-button" onClick={() => openCreateModal()}>
          그룹 등록
        </Button>
      </header>

      <GroupListTable />

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
      <GroupAddMembersModal
        open={isAddMembersModalOpen}
        groupId={addMembersTargetGroupId}
        groupCode={addMembersTargetGroupRow?.groupCode ?? null}
        onClose={closeAddMembersModal}
      />
    </div>
  )
}
