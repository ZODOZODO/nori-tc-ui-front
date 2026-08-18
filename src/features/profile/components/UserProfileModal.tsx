import { useEffect, useMemo, useState } from 'react'
import { Loader2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/i18n-context'
import { useMe, useResetPassword, useUpdateUser, useUserDetail } from '../hooks/useProfile'
import { ApiError } from '@/shared/lib/api-error'

interface UserProfileModalProps {
  open: boolean
  onClose: () => void
}

interface ProfileFormState {
  company: string
  department: string
  userName: string
  userId: string
  email: string
  status: string
}

/**
 * Eqp 화면 상단 프로필 아이콘에서 여는 사용자 정보 수정 모달입니다.
 * GET /api/auth/me -> GET /api/user/{userPk} 순서로 데이터를 읽고,
 * 저장 시 PUT /api/user/{userPk}, 비밀번호 변경 시 POST /api/user/{userPk}/password/reset을 호출합니다.
 */
export function UserProfileModal({ open, onClose }: UserProfileModalProps) {
  const { t } = useI18n()
  const [draftFormState, setDraftFormState] = useState<Partial<ProfileFormState>>({})
  const [showPasswordEditor, setShowPasswordEditor] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  const meQuery = useMe(open)
  const userPk = open ? (meQuery.data?.userPk ?? null) : null
  const userDetailQuery = useUserDetail(userPk, open && userPk !== null)

  const updateUserMutation = useUpdateUser()
  const resetPasswordMutation = useResetPassword()

  const isBusy = updateUserMutation.isPending || resetPasswordMutation.isPending

  /**
   * 모달 열린 상태에서 ESC 로 닫기.
   *
   * 이 모달은 Dialog 프리미티브를 쓰지 않고 `role="dialog"` 를 직접 달아서 Radix 가 기본으로 주는
   * ESC 닫기가 없다. 그대로 두면 나머지 오버레이 36 건과 달리 이 하나만 키보드로 빠져나갈 수 없다.
   * `LoginPage` 의 RecoveryModal 도 같은 수기 구현이고 같은 방식으로 처리한다.
   *
   * 저장/비밀번호 변경 중에는 닫지 않는다 — 진행 중인 요청을 화면만 먼저 사라지게 만들지 않는다.
   */
  useEffect(() => {
    if (!open) {
      return
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscapeKey)
    return () => {
      window.removeEventListener('keydown', handleEscapeKey)
    }
  }, [open, isBusy, onClose])

  /**
   * 서버 원본 데이터 + 사용자가 수정 중인 draft 값을 합쳐 현재 폼 값을 만듭니다.
   * useEffect 동기화 없이도 데이터 로딩/재요청에 안전하게 대응할 수 있습니다.
   */
  const resolvedFormState = useMemo<ProfileFormState>(
    () => ({
      company: draftFormState.company ?? userDetailQuery.data?.company ?? '',
      department: draftFormState.department ?? userDetailQuery.data?.department ?? '',
      userName: draftFormState.userName ?? userDetailQuery.data?.userName ?? '',
      userId: draftFormState.userId ?? userDetailQuery.data?.userId ?? '',
      email: draftFormState.email ?? userDetailQuery.data?.email ?? '',
      status: draftFormState.status ?? userDetailQuery.data?.status ?? 'ACTIVE',
    }),
    [draftFormState, userDetailQuery.data],
  )

  const modalErrorMessage = useMemo(() => {
    if (meQuery.error instanceof ApiError) {
      return meQuery.error.payload.errorMsg
    }

    if (userDetailQuery.error instanceof ApiError) {
      return userDetailQuery.error.payload.errorMsg
    }

    return null
  }, [meQuery.error, userDetailQuery.error])

  const resetTransientState = () => {
    setDraftFormState({})
    setShowPasswordEditor(false)
    setNewPassword('')
    setFeedbackMessage(null)
  }

  const closeModal = () => {
    if (isBusy) {
      return
    }
    resetTransientState()
    onClose()
  }

  const handleFieldChange = (field: keyof ProfileFormState, value: string) => {
    setDraftFormState((prev) => ({
      ...prev,
      [field]: value,
    }))
    setFeedbackMessage(null)
  }

  const handleSaveProfile = async () => {
    if (!userPk) {
      setFeedbackMessage(t('profile.feedback.noUserSave'))
      return
    }

    try {
      setFeedbackMessage(null)
      await updateUserMutation.mutateAsync({
        userPk,
        request: {
          company: resolvedFormState.company.trim(),
          department: resolvedFormState.department.trim(),
          userName: resolvedFormState.userName.trim(),
          userId: resolvedFormState.userId,
          password: null,
          email: resolvedFormState.email.trim(),
          status: resolvedFormState.status,
          updatedBy: meQuery.data?.userId ?? resolvedFormState.userId,
        },
      })
      closeModal()
    } catch (error) {
      if (error instanceof ApiError) {
        setFeedbackMessage(error.payload.errorMsg)
        return
      }

      setFeedbackMessage(t('profile.feedback.saveError'))
    }
  }

  const handleResetPassword = async () => {
    if (!userPk) {
      setFeedbackMessage(t('profile.feedback.noUserPw'))
      return
    }

    const trimmedPassword = newPassword.trim()
    if (trimmedPassword.length < 8) {
      setFeedbackMessage(t('profile.feedback.pwMin'))
      return
    }

    try {
      setFeedbackMessage(null)
      await resetPasswordMutation.mutateAsync({
        userPk,
        request: {
          newPassword: trimmedPassword,
          updatedBy: meQuery.data?.userId ?? resolvedFormState.userId,
        },
      })
      setNewPassword('')
      setShowPasswordEditor(false)
      setFeedbackMessage(t('profile.feedback.pwChanged'))
    } catch (error) {
      if (error instanceof ApiError) {
        setFeedbackMessage(error.payload.errorMsg)
        return
      }

      setFeedbackMessage(t('profile.feedback.pwError'))
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/50 px-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-modal-title"
        className="w-full max-w-160 rounded-3xl border border-border bg-card p-6.5 text-foreground shadow-soft-lg"
      >
        <div className="flex flex-col gap-4.5">
          <header className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-brand-primary/10">
              <UserRound className="size-5 text-brand-primary" />
            </div>
            <div className="flex-1">
              <h2 id="user-profile-modal-title" className="text-2xl font-bold text-foreground">
                {t('profile.title')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('profile.subtitle')}</p>
            </div>
          </header>

          {meQuery.isLoading || userDetailQuery.isLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-border bg-muted/40 py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
              {t('profile.loading')}
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-company" className="text-[11px] font-bold uppercase text-muted-foreground">
                    company
                  </label>
                  <Input
                    id="profile-company"
                    value={resolvedFormState.company}
                    onChange={(event) => handleFieldChange('company', event.target.value)}
                    className="h-11.5 rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-user-name" className="text-[11px] font-bold uppercase text-muted-foreground">
                    user_name
                  </label>
                  <Input
                    id="profile-user-name"
                    value={resolvedFormState.userName}
                    onChange={(event) => handleFieldChange('userName', event.target.value)}
                    className="h-11.5 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="profile-user-id" className="text-[11px] font-bold uppercase text-muted-foreground">
                  user_id
                </label>
                <Input
                  id="profile-user-id"
                  value={resolvedFormState.userId}
                  readOnly
                  className="h-11.5 rounded-xl bg-muted text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground">{t('profile.userIdReadonly')}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="profile-password" className="text-[11px] font-bold uppercase text-muted-foreground">
                  password
                </label>
                <div className="flex gap-2">
                  <Input
                    id="profile-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    disabled={!showPasswordEditor}
                    placeholder={showPasswordEditor ? t('profile.pwPlaceholder') : '••••••••'}
                    className="h-11.5 rounded-xl"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11.5 rounded-[19px] px-4 text-xs font-semibold"
                    onClick={() => {
                      if (showPasswordEditor) {
                        void handleResetPassword()
                        return
                      }
                      setShowPasswordEditor(true)
                      setFeedbackMessage(null)
                    }}
                    disabled={isBusy}
                  >
                    {resetPasswordMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    {showPasswordEditor ? t('profile.save') : t('profile.pwChange')}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="profile-email" className="text-[11px] font-bold uppercase text-muted-foreground">
                  email
                </label>
                <Input
                  id="profile-email"
                  type="email"
                  value={resolvedFormState.email}
                  onChange={(event) => handleFieldChange('email', event.target.value)}
                  className="h-11.5 rounded-xl"
                />
              </div>

              <p className="text-[11px] text-muted-foreground">{t('profile.pwHint')}</p>
            </>
          )}

          <div className="h-px w-full bg-border" />

          {modalErrorMessage || feedbackMessage ? (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {feedbackMessage ?? modalErrorMessage}
            </p>
          ) : null}

          <footer className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5 text-sm font-semibold"
              onClick={closeModal}
              disabled={isBusy}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={() => void handleSaveProfile()}
              disabled={isBusy || meQuery.isLoading || userDetailQuery.isLoading}
            >
              {updateUserMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('profile.save')}
            </Button>
          </footer>
        </div>
      </section>
    </div>
  )
}
