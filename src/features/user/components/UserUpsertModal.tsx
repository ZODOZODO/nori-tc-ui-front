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
import { useCreateUser, useUpdateUser } from '../hooks/useUserMutations'
import { useUserDetail } from '../hooks/useUsers'
import type { UiUserStatusLiteral, UserCreateRequest, UserUpdateRequest } from '../types/user.types'
import { UserApiError } from '../types/user.types'

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
      setErrorMessage('필수 입력값(회사, 부서, 이름, 아이디, 이메일)을 모두 채워주세요.')
      return
    }

    try {
      if (mode === 'create') {
        if (trimmed.password.length === 0) {
          setErrorMessage('등록 시 비밀번호는 필수입니다.')
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
          setErrorMessage('수정 대상 사용자를 확인할 수 없습니다.')
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
      if (error instanceof UserApiError) {
        setErrorMessage(error.payload.errorMsg)
        return
      }
      setErrorMessage('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? handleClose() : null)}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '사용자 등록' : '사용자 수정'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '새 사용자 계정을 등록합니다. 비밀번호는 필수입니다.'
              : '사용자 정보를 수정합니다. 비밀번호 입력값을 비워두면 기존 비밀번호가 유지됩니다.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-company" className="text-xs font-semibold text-[#4A5A52]">
              회사
            </label>
            <Input
              id="user-upsert-company"
              value={resolvedFormState.company}
              onChange={(event) => handleChange('company', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-department" className="text-xs font-semibold text-[#4A5A52]">
              부서
            </label>
            <Input
              id="user-upsert-department"
              value={resolvedFormState.department}
              onChange={(event) => handleChange('department', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-user-name" className="text-xs font-semibold text-[#4A5A52]">
              이름
            </label>
            <Input
              id="user-upsert-user-name"
              value={resolvedFormState.userName}
              onChange={(event) => handleChange('userName', event.target.value)}
              disabled={isBusy}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-user-id" className="text-xs font-semibold text-[#4A5A52]">
              아이디
            </label>
            <Input
              id="user-upsert-user-id"
              value={resolvedFormState.userId}
              onChange={(event) => handleChange('userId', event.target.value)}
              disabled={isBusy || mode === 'edit'}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="user-upsert-email" className="text-xs font-semibold text-[#4A5A52]">
              이메일
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
            <label htmlFor="user-upsert-password" className="text-xs font-semibold text-[#4A5A52]">
              비밀번호 {mode === 'create' ? '(필수)' : '(미입력 시 유지)'}
            </label>
            <Input
              id="user-upsert-password"
              type="password"
              value={resolvedFormState.password}
              onChange={(event) => handleChange('password', event.target.value)}
              disabled={isBusy}
              placeholder={mode === 'create' ? '새 비밀번호 입력' : '변경 시에만 입력'}
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label htmlFor="user-upsert-status" className="text-xs font-semibold text-[#4A5A52]">
              상태
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
          <p className="rounded-md border border-[#F0D2D0] bg-[#FFF7F7] px-3 py-2 text-sm text-[#B4483F]">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isBusy}>
            취소
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isBusy}
            data-testid="user-upsert-submit"
          >
            {isBusy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {mode === 'create' ? '등록' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
