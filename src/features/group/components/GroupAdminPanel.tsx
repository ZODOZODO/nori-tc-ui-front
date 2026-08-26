import { useMemo } from 'react'
import { CircleCheck, CircleOff, Plus, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageMetricGrid } from '@/shared/layout/PageMetricGrid'
import { TableSectionHeader } from '@/shared/layout/TableSectionHeader'
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

  // 목록 테이블과 같은 파라미터로 호출해 쿼리 캐시를 공유한다(추가 요청 없음).
  const groupListQuery = useGroups(listOffset, GROUP_PAGE_SIZE)
  const visibleGroups = groupListQuery.data?.items ?? []
  const activeCount = visibleGroups.filter((group) => group.isActive).length
  const inactiveCount = visibleGroups.length - activeCount

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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      {/* 페이지 제목(h1)은 /user 페이지가 갖는다 — 여기는 모드 섹션 제목(h2)이다. */}
      <TableSectionHeader
        title={t('group.title')}
        subtitle={t('group.description')}
        count={groupListQuery.data?.count ?? 0}
        actions={
          <Button type="button" data-testid="group-create-button" onClick={() => openCreateModal()}>
            <Plus aria-hidden="true" />
            {t('group.create')}
          </Button>
        }
      />

      <PageMetricGrid
        ariaLabel={t('group.summary.ariaLabel')}
        items={[
          {
            key: 'TOTAL',
            label: t('group.summary.total'),
            value: groupListQuery.data?.count ?? 0,
            icon: UsersRound,
            tone: 'neutral',
          },
          {
            key: 'ACTIVE',
            label: t('group.summary.activeOnPage'),
            value: activeCount,
            icon: CircleCheck,
            tone: 'brand',
          },
          {
            key: 'INACTIVE',
            label: t('group.summary.inactiveOnPage'),
            value: inactiveCount,
            icon: CircleOff,
            tone: 'warning',
          },
        ]}
      />

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
