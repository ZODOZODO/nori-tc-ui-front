import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/i18n/i18n-context'
import { useGroups } from '../hooks/useGroups'
import { useGroupUiStore } from '../stores/group-ui.store'
import { GroupAddMembersModal } from './GroupAddMembersModal'
import { GroupDeleteConfirmDialog } from './GroupDeleteConfirmDialog'
import { GROUP_PAGE_SIZE, GroupListTable } from './GroupListTable'
import { GroupPermissionsModal } from './GroupPermissionsModal'
import { GroupUpsertModal } from './GroupUpsertModal'

export function GroupAdminPanel() {
  const { t } = useI18n()
  const listOffset = useGroupUiStore((state) => state.listOffset)
  const activeGroupId = useGroupUiStore((state) => state.activeGroupId)
  const isUpsertModalOpen = useGroupUiStore((state) => state.isUpsertModalOpen)
  const upsertMode = useGroupUiStore((state) => state.upsertMode)
  const isDeleteDialogOpen = useGroupUiStore((state) => state.isDeleteDialogOpen)
  const pendingDeleteGroupId = useGroupUiStore((state) => state.pendingDeleteGroupId)
  const isAddMembersModalOpen = useGroupUiStore((state) => state.isAddMembersModalOpen)
  const addMembersTargetGroupId = useGroupUiStore((state) => state.addMembersTargetGroupId)
  const isPermissionsModalOpen = useGroupUiStore((state) => state.isPermissionsModalOpen)
  const permissionsTargetGroupId = useGroupUiStore((state) => state.permissionsTargetGroupId)
  const openCreateModal = useGroupUiStore((state) => state.openCreateModal)
  const closeUpsertModal = useGroupUiStore((state) => state.closeUpsertModal)
  const closeDeleteDialog = useGroupUiStore((state) => state.closeDeleteDialog)
  const closeAddMembersModal = useGroupUiStore((state) => state.closeAddMembersModal)
  const closePermissionsModal = useGroupUiStore((state) => state.closePermissionsModal)

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

  const permissionsTargetGroupRow = useMemo(() => {
    if (permissionsTargetGroupId === null) {
      return null
    }
    return (
      groupListQuery.data?.items.find((group) => group.groupId === permissionsTargetGroupId) ?? null
    )
  }, [permissionsTargetGroupId, groupListQuery.data?.items])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
      {/* 제목(h1)과 설명은 라우트 헤딩(AppPageHeading)이 그린다 — 한 화면에 같은 문장을 두 번 두지
          않는다. 이 줄은 총건수 / 액션만 담당한다. 좌우 여백도 페이지 shell 이 소유한다. */}
      <div className="flex shrink-0 items-start justify-end gap-4">
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="tabular-nums">
            {(groupListQuery.data?.count ?? 0).toLocaleString()}
          </Badge>
          <Button type="button" data-testid="group-create-button" onClick={() => openCreateModal()}>
            {t('group.create')}
          </Button>
        </div>
      </div>

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
      <GroupPermissionsModal
        open={isPermissionsModalOpen}
        groupId={permissionsTargetGroupId}
        groupCode={permissionsTargetGroupRow?.groupCode ?? null}
        onClose={closePermissionsModal}
      />
    </div>
  )
}
