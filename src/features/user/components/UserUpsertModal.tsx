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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/i18n/i18n-context'
import { useCreateUser, useUpdateUser } from '../hooks/useUserMutations'
import { useUserDetail } from '../hooks/useUsers'
import type { UiUserStatusLiteral, UserCreateRequest, UserUpdateRequest } from '../types/user.types'
import { notifyFailure } from '@/shared/lib/notify'

interface UserUpsertModalProps {
  open: boolean
  mode: 'create' | 'edit'
  targetUserPk: number | null
  onClose: () => void
}

interface UserUpsertFormState {
  company: string
  department: string
  userName: string
  userId: string
  password: string
  email: string
  status: UiUserStatusLiteral
}

type DraftFormState = Partial<UserUpsertFormState>

const STATUS_OPTIONS: readonly UiUserStatusLiteral[] = [
  'ACTIVE',
  'LOCKED',
  'DISABLED',
  'DELETED',
] as const

const isUiUserStatus = (value: string): value is UiUserStatusLiteral =>
  STATUS_OPTIONS.includes(value as UiUserStatusLiteral)

/**
 * 사용자 등록 / 수정 공용 모달입니다.
 * - 등록: password 필수
 * - 수정: password 빈 값이면 미전송 (백엔드가 password=null 을 기존 유지로 해석)
 *
 * 폼 상태는 draft + 서버 응답을 useMemo 로 머지합니다.
 * (UserProfileModal 의 resolvedFormState 패턴과 동일 — useEffect 동기화 회피)
 */
export function UserUpsertModal({ open, mode, targetUserPk, onClose }: UserUpsertModalProps) {
  const { t } = useI18n()
  const [draftFormState, setDraftFormState] = useState<DraftFormState>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const userDetailQuery = useUserDetail(
    mode === 'edit' ? targetUserPk : null,
    open && mode === 'edit',
  )
  const createUserMutation = useCreateUser()
  const updateUserMutation = useUpdateUser()
  const isBusy = createUserMutation.isPending || updateUserMutation.isPending

  const resolvedFormState = useMemo<UserUpsertFormState>(() => {
    if (mode === 'create') {
      return {
        company: draftFormState.company ?? '',
        department: draftFormState.department ?? '',
        userName: draftFormState.userName ?? '',
        userId: draftFormState.userId ?? '',
        password: draftFormState.password ?? '',
        email: draftFormState.email ?? '',
        status: draftFormState.status ?? 'ACTIVE',
      }
    }

    const detail = userDetailQuery.data
    const detailStatus = detail && isUiUserStatus(detail.status) ? detail.status : 'ACTIVE'
    return {
      company: draftFormState.company ?? detail?.company ?? '',
      department: draftFormState.department ?? detail?.department ?? '',
      userName: draftFormState.userName ?? detail?.userName ?? '',
      userId: draftFormState.userId ?? detail?.userId ?? '',
      password: draftFormState.password ?? '',
      email: draftFormState.email ?? detail?.email ?? '',
      status: draftFormState.status ?? detailStatus,
    }
  }, [mode, draftFormState, userDetailQuery.data])

  const handleClose = () => {
    if (isBusy) {
      return
    }
    setDraftFormState({})
    setErrorMessage(null)
    onClose()
  }

  const handleChange = <K extends keyof UserUpsertFormState>(
    field: K,
    value: UserUpsertFormState[K],
  ) => {
    setDraftFormState((previous) => ({ ...previous, [field]: value }))
  }

  const handleSubmit = async () => {
    setErrorMessage(null)
    const trimmed: UserUpsertFormState = {
      company: resolvedFormState.company.trim(),
      department: resolvedFormState.department.trim(),
      userName: resolvedFormState.userName.trim(),
      userId: resolvedFormState.userId.trim(),
      password: resolvedFormState.password,
      email: resolvedFormState.email.trim(),
      status: resolvedFormState.status,
    }

    if (
      !trimmed.company ||
      !trimmed.department ||
      !trimmed.userName ||
      !trimmed.userId ||
      !trimmed.email
    ) {
      setErrorMessage(t('user.upsert.requiredFields'))
      return
    }

    try {
      if (mode === 'create') {
        if (trimmed.password.length === 0) {
          setErrorMessage(t('user.upsert.passwordRequired'))
          return
        }
        const request: UserCreateRequest = {
          company: trimmed.company,
          department: trimmed.department,
          userName: trimmed.userName,
          userId: trimmed.userId,
          password: trimmed.password,
          email: trimmed.email,
          status: trimmed.status,
        }
        await createUserMutation.mutateAsync(request)
      } else {
        if (targetUserPk === null) {
          setErrorMessage(t('user.upsert.targetNotFound'))
          return
        }
        const request: UserUpdateRequest = {
          company: trimmed.company,
          department: trimmed.department,
          userName: trimmed.userName,
          userId: trimmed.userId,
          email: trimmed.email,
          status: trimmed.status,
          password: trimmed.password.length > 0 ? trimmed.password : null,
        }
        await updateUserMutation.mutateAsync({ userPk: targetUserPk, request })
      }
      setDraftFormState({})
      onClose()
    } catch (error) {
      setErrorMessage(notifyFailure(error, t('user.upsert.saveError')))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? handleClose() : null)}>
      <DialogContent className="max-w-140">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('user.create') : t('user.upsert.titleEdit')}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? t('user.upsert.descCreate') : t('user.upsert.descEdit')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-company" className="text-xs font-semibold text-muted-foreground">
              {t('user.form.company')}
            </label>
            <Input
              id="user-upsert-company"
              value={resolvedFormState.company}
              onChange={(event) => handleChange('company', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-department" className="text-xs font-semibold text-muted-foreground">
              {t('user.form.department')}
            </label>
            <Input
              id="user-upsert-department"
              value={resolvedFormState.department}
              onChange={(event) => handleChange('department', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-user-name" className="text-xs font-semibold text-muted-foreground">
              {t('user.form.name')}
            </label>
            <Input
              id="user-upsert-user-name"
              value={resolvedFormState.userName}
              onChange={(event) => handleChange('userName', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-user-id" className="text-xs font-semibold text-muted-foreground">
              {t('user.form.userId')}
            </label>
            <Input
              id="user-upsert-user-id"
              value={resolvedFormState.userId}
              onChange={(event) => handleChange('userId', event.target.value)}
              disabled={isBusy || mode === 'edit'}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-email" className="text-xs font-semibold text-muted-foreground">
              {t('user.form.email')}
            </label>
            <Input
              id="user-upsert-email"
              type="email"
              value={resolvedFormState.email}
              onChange={(event) => handleChange('email', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-password" className="text-xs font-semibold text-muted-foreground">
              {t('user.form.password')}{' '}
              {mode === 'create'
                ? t('user.form.passwordRequiredSuffix')
                : t('user.form.passwordOptionalSuffix')}
            </label>
            <Input
              id="user-upsert-password"
              type="password"
              value={resolvedFormState.password}
              onChange={(event) => handleChange('password', event.target.value)}
              disabled={isBusy}
              placeholder={
                mode === 'create'
                  ? t('user.upsert.pwPlaceholderCreate')
                  : t('user.upsert.pwPlaceholderEdit')
              }
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label htmlFor="user-upsert-status" className="text-xs font-semibold text-muted-foreground">
              {t('user.form.status')}
            </label>
            <Select
              value={resolvedFormState.status}
              onValueChange={(nextValue) => {
                if (isUiUserStatus(nextValue)) {
                  handleChange('status', nextValue)
                }
              }}
              disabled={isBusy}
            >
              <SelectTrigger id="user-upsert-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((statusOption) => (
                  <SelectItem key={statusOption} value={statusOption}>
                    {statusOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {errorMessage ? (
          <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isBusy}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isBusy}
            data-testid="user-upsert-submit"
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {mode === 'create' ? t('user.upsert.submitCreate') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
