import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/i18n-context'
import { useAddGroupPermission, useRemoveGroupPermission } from '../hooks/useGroupMutations'
import { useAllPermissions, useGroupPermissions } from '../hooks/useGroups'
import {
  PERMISSION_CATEGORY_ORDER,
  resolvePermissionCategory,
} from '../lib/permission-category'
import { GroupApiError, type PermissionInfo } from '../types/group.types'

interface GroupPermissionsModalProps {
  open: boolean
  groupId: number | null
  groupCode: string | null
  onClose: () => void
}

/**
 * 그룹별 권한을 부여/회수하는 모달입니다.
 *
 * - 전체 활성 권한 카탈로그(`useAllPermissions`)를 페이지/기능 카테고리(`resolvePermissionCategory`)
 *   별로 묶어 체크리스트로 나열한다. raw resource URL 대신 카테고리 라벨 + 권한명/설명을 보여 가독성↑.
 * - 그룹 보유 권한(`useGroupPermissions`)은 permId 기준이므로 permId 로 교차해 체크 상태를 결정.
 * - 체크는 **로컬 draft**(`pendingChanges`: 서버 상태 대비 변경분만)로만 반영한다.
 *   저장 시 변경분을 일괄 POST/DELETE, 취소(또는 닫기) 시 변경분 폐기.
 * - 검색 input 으로 permName/permCode/설명 필터링 (대소문자 무시).
 */
export function GroupPermissionsModal({ open, groupId, groupCode, onClose }: GroupPermissionsModalProps) {
  const { t } = useI18n()
  const permissionCatalogQuery = useAllPermissions(open)
  const groupPermissionsQuery = useGroupPermissions(groupId, open && groupId !== null)
  const addPermissionMutation = useAddGroupPermission()
  const removePermissionMutation = useRemoveGroupPermission()

  const [searchKeyword, setSearchKeyword] = useState('')
  // 서버 보유 상태 대비 "변경분"만 보관한다 (permId → 원하는 보유 여부). 저장 전까지 API 호출 없음.
  const [pendingChanges, setPendingChanges] = useState<ReadonlyMap<number, boolean>>(new Map())
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 모달이 닫히면 다음 오픈을 위해 입력/draft 상태를 초기화한다. effect 대신 render 중
  // prop 변화 감지로 처리 — cascading render 회피 (react-hooks/set-state-in-effect).
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setSearchKeyword('')
      setPendingChanges(new Map())
      setIsSaving(false)
      setErrorMessage(null)
    }
  }

  const serverGrantedPermIds = useMemo<ReadonlySet<number>>(() => {
    const items = groupPermissionsQuery.data?.items ?? []
    return new Set(items.map((mapping) => mapping.permId))
  }, [groupPermissionsQuery.data?.items])

  // 서버 상태 + draft 오버레이로 현재(미저장 포함) 보유 여부를 계산한다.
  const isGranted = (permId: number): boolean => {
    const pending = pendingChanges.get(permId)
    return pending === undefined ? serverGrantedPermIds.has(permId) : pending
  }

  const activePermissions = useMemo<PermissionInfo[]>(() => {
    const items = permissionCatalogQuery.data?.items ?? []
    const keyword = searchKeyword.trim().toLowerCase()
    const onlyActive = items.filter((permission) => permission.isActive)
    if (keyword.length === 0) {
      return onlyActive
    }
    return onlyActive.filter(
      (permission) =>
        permission.permCode.toLowerCase().includes(keyword) ||
        permission.permName.toLowerCase().includes(keyword) ||
        (permission.description ?? '').toLowerCase().includes(keyword),
    )
  }, [permissionCatalogQuery.data?.items, searchKeyword])

  const groupedPermissions = useMemo(() => {
    const byCategory = new Map<string, PermissionInfo[]>()
    for (const permission of activePermissions) {
      const key = resolvePermissionCategory(permission.permCode)
      const bucket = byCategory.get(key)
      if (bucket) {
        bucket.push(permission)
      } else {
        byCategory.set(key, [permission])
      }
    }
    return PERMISSION_CATEGORY_ORDER.map((key) => ({
      key,
      permissions: (byCategory.get(key) ?? []).sort((a, b) => a.permCode.localeCompare(b.permCode)),
    })).filter((group) => group.permissions.length > 0)
  }, [activePermissions])

  const allActivePermissions = useMemo(
    () => (permissionCatalogQuery.data?.items ?? []).filter((p) => p.isActive),
    [permissionCatalogQuery.data?.items],
  )

  // 미저장 변경분(draft)을 반영한 보유 권한 수.
  const grantedActiveCount = useMemo(
    () =>
      allActivePermissions.filter((permission) => {
        const pending = pendingChanges.get(permission.permId)
        return pending === undefined ? serverGrantedPermIds.has(permission.permId) : pending
      }).length,
    [allActivePermissions, pendingChanges, serverGrantedPermIds],
  )

  const isLoading = permissionCatalogQuery.isLoading || groupPermissionsQuery.isLoading
  const hasChanges = pendingChanges.size > 0

  const toggle = (permission: PermissionInfo) => {
    const serverState = serverGrantedPermIds.has(permission.permId)
    const desired = !isGranted(permission.permId)
    setPendingChanges((previous) => {
      const next = new Map(previous)
      if (desired === serverState) {
        // 서버 상태로 되돌아오면 변경분 제거.
        next.delete(permission.permId)
      } else {
        next.set(permission.permId, desired)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (groupId === null) {
      setErrorMessage(t('group.permissions.noTargetGroup'))
      return
    }
    const operations = Array.from(pendingChanges.entries())
    if (operations.length === 0) {
      onClose()
      return
    }

    setErrorMessage(null)
    setIsSaving(true)
    const results = await Promise.allSettled(
      operations.map(([permId, desired]) =>
        desired
          ? addPermissionMutation.mutateAsync({ groupId, permId })
          : removePermissionMutation.mutateAsync({ groupId, permId }),
      ),
    )
    setIsSaving(false)

    // 실패한 변경분만 draft 에 남기고, 성공분은 제거(서버 상태에 반영됨).
    const stillPending = new Map<number, boolean>()
    let firstErrorMessage: string | null = null
    results.forEach((result, index) => {
      const [permId, desired] = operations[index]
      if (result.status === 'rejected') {
        stillPending.set(permId, desired)
        if (firstErrorMessage === null) {
          firstErrorMessage =
            result.reason instanceof GroupApiError
              ? result.reason.payload.errorMsg
              : t('error.group.default')
        }
      }
    })
    setPendingChanges(stillPending)

    if (firstErrorMessage !== null) {
      setErrorMessage(firstErrorMessage)
      return
    }
    onClose()
  }

  const handleCancel = () => {
    if (isSaving) {
      return
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? handleCancel() : null)}>
      <DialogContent className="max-w-200">
        <DialogHeader>
          <DialogTitle>{t('group.permissions.title')}</DialogTitle>
          <DialogDescription>
            {groupCode
              ? t('group.permissions.descWithCode', { code: groupCode })
              : t('group.permissions.descNoTarget')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Input
              placeholder={t('group.permissions.searchPlaceholder')}
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              disabled={isLoading || isSaving}
              data-testid="group-permissions-search"
            />
            <span
              className="shrink-0 text-xs text-muted-foreground"
              data-testid="group-permissions-summary"
            >
              {t('group.permissions.grantedCount', {
                granted: grantedActiveCount,
                total: allActivePermissions.length,
              })}
            </span>
          </div>

          <div
            className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto rounded-md border border-border p-2"
            data-testid="group-permissions-list"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t('group.permissions.loading')}
              </div>
            ) : groupedPermissions.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {t('group.permissions.empty')}
              </p>
            ) : (
              groupedPermissions.map((group) => (
                <div key={group.key} className="flex flex-col gap-1">
                  <p className="border-b border-border px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    {t(`group.permissions.category.${group.key}`)}
                  </p>
                  {group.permissions.map((permission) => (
                    <label
                      key={permission.permId}
                      className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      data-testid={`group-permissions-row-${permission.permId}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={isGranted(permission.permId)}
                        disabled={isSaving}
                        onChange={() => toggle(permission)}
                        data-testid={`group-permissions-checkbox-${permission.permId}`}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{permission.permName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {permission.permCode}
                          </span>
                        </span>
                        {permission.description ? (
                          <span className="text-xs text-muted-foreground">
                            {permission.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        {permission.httpMethod ?? 'ALL'}
                      </span>
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>

          {errorMessage ? (
            <p
              className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger"
              data-testid="group-permissions-error"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
            data-testid="group-permissions-cancel"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasChanges}
            data-testid="group-permissions-save"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
