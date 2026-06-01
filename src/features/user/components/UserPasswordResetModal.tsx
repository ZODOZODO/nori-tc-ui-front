import { useEffect, useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useI18n } from '@/i18n/i18n-context'
import { useResetPassword } from '../hooks/useUserMutations'
import { generateTemporaryPassword } from '../lib/password-generator'
import { UserApiError } from '../types/user.types'

interface UserPasswordResetModalProps {
  open: boolean
  targetUserPk: number | null
  targetUserId: string | null
  onClose: () => void
}

type CopyState = 'idle' | 'success' | 'error'

/**
 * 비밀번호 초기화 모달입니다.
 * - 열릴 때 12자 랜덤 비밀번호를 생성하여 평문 1회 표시
 * - 클립보드 복사 버튼 제공
 * - 모달 닫기 시 state 클리어 — 닫으면 비밀번호는 다시 표시되지 않음
 */
export function UserPasswordResetModal({
  open,
  targetUserPk,
  targetUserId,
  onClose,
}: UserPasswordResetModalProps) {
  const { t } = useI18n()
  const resetPasswordMutation = useResetPassword()
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [resetStatus, setResetStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open || targetUserPk === null) {
      setGeneratedPassword(null)
      setResetStatus('pending')
      setCopyState('idle')
      setErrorMessage(null)
      return
    }

    let cancelled = false
    const newPassword = generateTemporaryPassword()
    setGeneratedPassword(newPassword)
    setResetStatus('pending')
    setErrorMessage(null)
    setCopyState('idle')

    const submit = async () => {
      try {
        await resetPasswordMutation.mutateAsync({
          userPk: targetUserPk,
          request: { newPassword },
        })
        if (!cancelled) {
          setResetStatus('success')
        }
      } catch (error) {
        if (cancelled) {
          return
        }
        setResetStatus('error')
        if (error instanceof UserApiError) {
          setErrorMessage(error.payload.errorMsg)
        } else {
          setErrorMessage(t('user.passwordReset.error'))
        }
      }
    }

    void submit()

    return () => {
      cancelled = true
    }
    // resetPasswordMutation 은 안정적이지 않은 참조라 의도적으로 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetUserPk])

  const handleCopy = async () => {
    if (!generatedPassword) {
      return
    }
    try {
      await navigator.clipboard.writeText(generatedPassword)
      setCopyState('success')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : null)}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('user.passwordReset.title')}</DialogTitle>
          <DialogDescription>
            {targetUserId
              ? t('user.passwordReset.doneWithId', { userId: targetUserId })
              : t('user.passwordReset.done')}
            <br />
            {t('user.passwordReset.warning')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <input
            data-testid="user-password-reset-value"
            readOnly
            value={generatedPassword ?? ''}
            className="h-11 w-full rounded-md border border-input bg-muted px-3 font-mono text-base text-foreground"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopy()}
            disabled={!generatedPassword}
            data-testid="user-password-reset-copy"
            aria-label={t('user.passwordReset.copyAria')}
          >
            <Copy className="size-4" aria-hidden="true" />
            {t('user.passwordReset.copy')}
          </Button>
        </div>

        {resetStatus === 'pending' ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('user.passwordReset.applying')}
          </p>
        ) : null}

        {resetStatus === 'error' && errorMessage ? (
          <p className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}

        {copyState === 'success' ? (
          <p className="text-xs text-success">{t('user.passwordReset.copied')}</p>
        ) : null}
        {copyState === 'error' ? (
          <p className="text-xs text-danger">{t('user.passwordReset.copyFailed')}</p>
        ) : null}

        <DialogFooter>
          <Button type="button" onClick={onClose} disabled={resetStatus === 'pending'}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
